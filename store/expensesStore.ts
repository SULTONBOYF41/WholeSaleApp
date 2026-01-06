// store/expensesStore.ts  (NO SUPABASE)
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

export type ExpenseKind = "family" | "shop" | "bank";

export type RowInput = {
    title: string;
    qty: number;
    price: number;
};

export type ExpenseItem = {
    id: string;
    batch_id: string;
    kind: ExpenseKind;
    title: string;
    qty: number;
    price: number;
    amount: number;
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
};

const LS_ITEMS = "expenses:items:v1";

function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}
const nowIso = () => new Date().toISOString();

function buildItemsFromRows(batchId: string, kind: ExpenseKind, createdAt: string, rows: RowInput[]): ExpenseItem[] {
    return rows.map((r) => {
        const qty = Number(r.qty || 0);
        const price = Number(r.price || 0);
        const amount = qty * price;
        return {
            id: uuidv4(),
            batch_id: batchId,
            kind,
            title: String(r.title || "").trim(),
            qty,
            price,
            amount,
            created_at: createdAt,
        };
    });
}

function calcDerived(items: ExpenseItem[]) {
    let family = 0, shop = 0, bank = 0;

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
        if (!Array.isArray(parsed)) return [];
        return parsed as ExpenseItem[];
    } catch {
        return [];
    }
}

async function saveLocalItems(items: ExpenseItem[]) {
    try {
        await AsyncStorage.setItem(LS_ITEMS, JSON.stringify(items));
    } catch { }
}

export const useExpensesStore = create<State>((set, get) => ({
    loading: false,
    items: [],
    totals: { family: 0, shop: 0, bank: 0, total: 0 },
    batchesByKind: { family: [], shop: [], bank: [] },

    fetchAll: async () => {
        set({ loading: true });
        try {
            const items = await loadLocalItems();
            const { totals, batchesByKind } = calcDerived(items);
            set({ items, totals, batchesByKind });
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
        const itemsNew = buildItemsFromRows(batchId, kind, createdAt, rows);

        const next = [...get().items, ...itemsNew];
        await saveLocalItems(next);
        const derived = calcDerived(next);
        set({ items: next, ...derived });
    },

    editBatch: async (batchId, kind, rows) => {
        const kept = get().items.filter((i) => String(i.batch_id) !== String(batchId));
        const createdAt = nowIso(); // xohlasangiz eski created_at ni saqlash ham mumkin
        const itemsNew = buildItemsFromRows(batchId, kind, createdAt, rows);

        const next = [...kept, ...itemsNew];
        await saveLocalItems(next);
        const derived = calcDerived(next);
        set({ items: next, ...derived });
    },

    deleteBatch: async (batchId) => {
        const next = get().items.filter((i) => String(i.batch_id) !== String(batchId));
        await saveLocalItems(next);
        const derived = calcDerived(next);
        set({ items: next, ...derived });
    },
}));
