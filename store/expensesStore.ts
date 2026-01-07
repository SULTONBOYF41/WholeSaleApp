// store/expensesStore.ts
import { api } from "@/lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";

export type ExpenseKind = "family" | "shop" | "bank";

export type RowInput = {
    title: string;
    qty: number;
    price: number;
    note?: string;
};

export type ExpenseItem = {
    id: string; // client_id bilan bir xil qilamiz (stable)
    batch_id: string;
    kind: ExpenseKind;
    title: string;
    qty: number;
    price: number;
    amount: number;
    note?: string;
    created_at: string; // ISO
};

export type ExpenseBatch = {
    id: string; // batch_id
    kind: ExpenseKind;
    created_at: string;
    items: ExpenseItem[];
    total: number;
};

type BatchSummary = { created_at: string; total: number };
type Totals = { family: number; shop: number; bank: number; total: number };

type QueueItem =
    | {
        t: "replace";
        batchId: string;
        kind: ExpenseKind;
        createdAt: string;
        rows: Array<{
            client_id: string;
            title: string;
            qty: number | null;
            price: number | null;
            amount: number;
            note?: string | null;
            created_at: string;
        }>;
        ts: number;
    }
    | { t: "delete"; batchId: string; ts: number };

type State = {
    loading: boolean;

    items: ExpenseItem[];
    totals: Totals;
    batchesByKind: Record<ExpenseKind, BatchSummary[]>;

    fetchAll: () => Promise<void>;
    listBatches: (kind: ExpenseKind) => ExpenseBatch[];

    addBatch: (kind: ExpenseKind, rows: RowInput[]) => Promise<void>;
    editBatch: (batchId: string, kind: ExpenseKind, rows: RowInput[]) => Promise<void>;
    deleteBatch: (batchId: string) => Promise<void>;

    // sync helpers
    processQueue: () => Promise<void>;
    pushAndPullNow: () => Promise<void>;
};

const LS_ITEMS = "expenses:items:v1";
const LS_QUEUE = "expenses:queue:v1";

function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
const nowIso = () => new Date().toISOString();

function calcDerived(items: ExpenseItem[]) {
    let family = 0,
        shop = 0,
        bank = 0;

    const map: Record<ExpenseKind, Map<string, number>> = {
        family: new Map(),
        shop: new Map(),
        bank: new Map(),
    };

    for (const it of items) {
        const a = Number(it.amount || 0);
        if (it.kind === "family") family += a;
        if (it.kind === "shop") shop += a;
        if (it.kind === "bank") bank += a;

        const key = String(it.created_at || "");
        map[it.kind].set(key, (map[it.kind].get(key) || 0) + a);
    }

    const mkSummaries = (m: Map<string, number>): BatchSummary[] =>
        [...m.entries()]
            .map(([created_at, total]) => ({ created_at, total }))
            .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));

    const batchesByKind = {
        family: mkSummaries(map.family),
        shop: mkSummaries(map.shop),
        bank: mkSummaries(map.bank),
    };

    const totals: Totals = { family, shop, bank, total: family + shop + bank };
    return { totals, batchesByKind };
}

async function loadLocalItems(): Promise<ExpenseItem[]> {
    try {
        const raw = await AsyncStorage.getItem(LS_ITEMS);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? (parsed as ExpenseItem[]) : [];
    } catch {
        return [];
    }
}
async function saveLocalItems(items: ExpenseItem[]) {
    try {
        await AsyncStorage.setItem(LS_ITEMS, JSON.stringify(items));
    } catch { }
}

async function loadQueue(): Promise<QueueItem[]> {
    try {
        const raw = await AsyncStorage.getItem(LS_QUEUE);
        if (!raw) return [];
        const q = JSON.parse(raw);
        return Array.isArray(q) ? (q as QueueItem[]) : [];
    } catch {
        return [];
    }
}
async function saveQueue(q: QueueItem[]) {
    try {
        await AsyncStorage.setItem(LS_QUEUE, JSON.stringify(q));
    } catch { }
}

async function isOnlineNow() {
    const st = await NetInfo.fetch();
    return !!(st.isConnected && st.isInternetReachable !== false);
}

function toNumber(v: any) {
    // Prisma Decimal ko'pincha string bo'ladi
    const n = typeof v === "string" ? Number(v) : Number(v ?? 0);
    return Number.isFinite(n) ? n : 0;
}

function normalizeServerExpenses(rows: any[]): ExpenseItem[] {
    if (!Array.isArray(rows)) return [];
    return rows.map((r) => {
        const created = r.createdAt || r.created_at;
        const createdIso =
            typeof created === "string"
                ? new Date(created).toISOString()
                : created instanceof Date
                    ? created.toISOString()
                    : nowIso();

        const kind = String(r.kind || "shop") as ExpenseKind;

        const qty = toNumber(r.qty);
        const price = toNumber(r.price);
        const amount = toNumber(r.amount);

        return {
            id: String(r.clientId || r.client_id || r.id || uuidv4()), // clientId unique
            batch_id: String(r.batchId || r.batch_id || ""),
            kind,
            title: String(r.title || ""),
            qty,
            price,
            amount,
            note: r.note == null ? undefined : String(r.note),
            created_at: createdIso,
        };
    });
}

function buildLocalItemsFromRows(batchId: string, kind: ExpenseKind, createdAt: string, rows: RowInput[]): ExpenseItem[] {
    return rows.map((r) => {
        const qty = Number(r.qty || 0);
        const price = Number(r.price || 0);
        const amount = qty * price;
        const id = uuidv4(); // client_id ham shu bo'ladi
        return {
            id,
            batch_id: batchId,
            kind,
            title: String(r.title || "").trim(),
            qty,
            price,
            amount,
            note: r.note ? String(r.note) : undefined,
            created_at: createdAt,
        };
    });
}

function buildServerPayloadFromLocal(items: ExpenseItem[], kind: ExpenseKind, createdAt: string) {
    return {
        kind,
        rows: items.map((it) => ({
            client_id: it.id, // backend client_id
            title: it.title,
            qty: it.qty ? Number(it.qty) : null,
            price: it.price ? Number(it.price) : null,
            amount: Number(it.amount),
            note: it.note ?? null,
            created_at: it.created_at || createdAt,
        })),
    };
}

export const useExpensesStore = create<State>((set, get) => ({
    loading: false,
    items: [],
    totals: { family: 0, shop: 0, bank: 0, total: 0 },
    batchesByKind: { family: [], shop: [], bank: [] },

    fetchAll: async () => {
        set({ loading: true });
        try {
            // online bo'lsa: avval queue push qilib keyin pull
            if (await isOnlineNow()) {
                try {
                    await get().processQueue();
                } catch { }

                try {
                    const r = await api.expenses.list();
                    const serverItems = normalizeServerExpenses(r?.data || []);
                    await saveLocalItems(serverItems);
                    set({ items: serverItems, ...calcDerived(serverItems) });
                    return;
                } catch {
                    // server ishlamasa localga tushamiz
                }
            }

            // local fallback
            const items = await loadLocalItems();
            set({ items, ...calcDerived(items) });
        } finally {
            set({ loading: false });
        }
    },

    listBatches: (kind) => {
        const items = get().items.filter((i) => i.kind === kind);

        const map = new Map<string, ExpenseItem[]>();
        for (const it of items) {
            const bid = String(it.batch_id);
            if (!map.has(bid)) map.set(bid, []);
            map.get(bid)!.push(it);
        }

        const out: ExpenseBatch[] = [];
        for (const [batch_id, xs] of map.entries()) {
            const created_at = xs[0]?.created_at ?? nowIso();
            const total = xs.reduce((s, x) => s + (Number(x.amount) || 0), 0);
            out.push({ id: batch_id, kind, created_at, items: xs, total });
        }

        return out.sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)));
    },

    addBatch: async (kind, rows) => {
        const batchId = uuidv4();
        const createdAt = nowIso();

        const itemsNew = buildLocalItemsFromRows(batchId, kind, createdAt, rows);

        // local save
        const next = [...get().items, ...itemsNew];
        await saveLocalItems(next);
        set({ items: next, ...calcDerived(next) });

        // server push or queue
        const payload = buildServerPayloadFromLocal(itemsNew, kind, createdAt);

        if (await isOnlineNow()) {
            try {
                await api.expenses.replaceBatch(batchId, payload);
                return;
            } catch {
                // server fail -> queue
            }
        }

        const q = await loadQueue();
        q.push({
            t: "replace",
            batchId,
            kind,
            createdAt,
            rows: payload.rows,
            ts: Date.now(),
        });
        await saveQueue(q);
    },

    editBatch: async (batchId, kind, rows) => {
        // eski created_at ni saqlab qolamiz (batch bo'yicha)
        const existing = get().items.filter((i) => String(i.batch_id) === String(batchId));
        const createdAt = existing[0]?.created_at || nowIso();

        // batchni localda tozalab qaytadan yozamiz
        const kept = get().items.filter((i) => String(i.batch_id) !== String(batchId));
        const itemsNew = buildLocalItemsFromRows(batchId, kind, createdAt, rows);

        const next = [...kept, ...itemsNew];
        await saveLocalItems(next);
        set({ items: next, ...calcDerived(next) });

        const payload = buildServerPayloadFromLocal(itemsNew, kind, createdAt);

        if (await isOnlineNow()) {
            try {
                await api.expenses.replaceBatch(batchId, payload);
                return;
            } catch { }
        }

        // queue: batch replace
        const q = await loadQueue();
        // bir batch uchun eski replace bo'lsa, yangisini overwrite qilamiz
        const filtered = q.filter((x) => !(x.t === "replace" && x.batchId === batchId));
        filtered.push({
            t: "replace",
            batchId,
            kind,
            createdAt,
            rows: payload.rows,
            ts: Date.now(),
        });
        await saveQueue(filtered);
    },

    deleteBatch: async (batchId) => {
        const next = get().items.filter((i) => String(i.batch_id) !== String(batchId));
        await saveLocalItems(next);
        set({ items: next, ...calcDerived(next) });

        if (await isOnlineNow()) {
            try {
                await api.expenses.deleteBatch(batchId);
                return;
            } catch { }
        }

        // queue delete (va shu batch uchun replace bo'lsa ham o'chiramiz)
        const q = await loadQueue();
        const filtered = q.filter((x) => !("batchId" in x && x.batchId === batchId));
        filtered.push({ t: "delete", batchId, ts: Date.now() });
        await saveQueue(filtered);
    },

    processQueue: async () => {
        if (!(await isOnlineNow())) return;

        let q = await loadQueue();
        if (!q.length) return;

        // ts bo'yicha tartib
        q = [...q].sort((a, b) => a.ts - b.ts);

        const remain: QueueItem[] = [];

        for (const it of q) {
            try {
                if (it.t === "replace") {
                    await api.expenses.replaceBatch(it.batchId, { kind: it.kind, rows: it.rows });
                } else if (it.t === "delete") {
                    await api.expenses.deleteBatch(it.batchId);
                }
            } catch {
                // server yana yiqilsa -> qolganlarini ham qoldiramiz
                remain.push(it);
            }
        }

        await saveQueue(remain);
    },

    pushAndPullNow: async () => {
        try {
            await get().processQueue();
        } catch { }
        try {
            await get().fetchAll();
        } catch { }
    },
}));
