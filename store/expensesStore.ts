// store/expensesStore.ts
import { api } from "@/lib/api";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";

/** --- TYPES --- */
export type ExpenseKind = "family" | "shop" | "bank";

export interface Expense {
    id: string;
    batch_id: string;
    kind: ExpenseKind;
    title: string;
    qty: number | null;
    price: number | null;
    amount: number;
    note?: string | null;
    created_at: string;
    client_id?: string | null;
}

export type RowInput = { title: string; qty: number; price: number; note?: string };

export interface ExpenseBatch {
    id: string;
    kind: ExpenseKind;
    created_at: string;
    total: number;
    items: Expense[];
}

type RowQueued = RowInput & { client_id?: string; created_at?: string };

type Totals = { family: number; shop: number; bank: number; all: number; total?: number };

type QueueItem =
    | { op: "add"; kind: ExpenseKind; rows: RowQueued[]; batch_id: string }
    | { op: "edit"; kind: ExpenseKind; rows: RowQueued[]; batch_id: string }
    | { op: "delete"; batch_id: string };

interface ExpensesState {
    loading: boolean;
    syncing: boolean;
    online: boolean;

    items: Expense[];
    batchesByKind: Record<ExpenseKind, ExpenseBatch[]>;
    totals: Totals;

    fetchAll: () => Promise<void>;
    addBatch: (kind: ExpenseKind, rows: RowInput[]) => Promise<string | null>;
    editBatch: (batch_id: string, kind: ExpenseKind, rows: RowInput[]) => Promise<void>;
    deleteBatch: (batch_id: string) => Promise<void>;
    listBatches: (k: ExpenseKind) => ExpenseBatch[];

    _ensureNetListener: () => void;
    _flushQueue: () => Promise<void>;
}

/** --- INTERNAL --- */
const QKEY = "expenses_queue_v2";
let NET_LISTENER_SET = false;

function uuidLike() {
    const rnd = (len: number) => Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return `${rnd(8)}-${rnd(4)}-${rnd(4)}-${rnd(4)}-${rnd(12)}`;
}

function fixNum(n: any): number {
    const v = Number(n);
    return Number.isFinite(v) ? v : 0;
}

async function pushOp(op: QueueItem) {
    const raw = (await AsyncStorage.getItem(QKEY)) ?? "[]";
    const arr = JSON.parse(raw) as QueueItem[];
    arr.push(op);
    await AsyncStorage.setItem(QKEY, JSON.stringify(arr));
}

async function readQueue(): Promise<QueueItem[]> {
    const raw = (await AsyncStorage.getItem(QKEY)) ?? "[]";
    try { return JSON.parse(raw) as QueueItem[]; } catch { return []; }
}

async function writeQueue(arr: QueueItem[]) {
    await AsyncStorage.setItem(QKEY, JSON.stringify(arr));
}

function groupBatches(items: Expense[]): Record<ExpenseKind, ExpenseBatch[]> {
    const map = new Map<string, ExpenseBatch>();
    for (const it of items) {
        if (!map.has(it.batch_id)) {
            map.set(it.batch_id, {
                id: it.batch_id,
                kind: it.kind,
                created_at: it.created_at,
                total: 0,
                items: [],
            });
        }
        const b = map.get(it.batch_id)!;
        b.items.push(it);

        const a = fixNum(it.amount ?? fixNum(it.qty) * fixNum(it.price));
        b.total += a;

        if (+new Date(it.created_at) < +new Date(b.created_at)) b.created_at = it.created_at;
    }

    const byKind: Record<ExpenseKind, ExpenseBatch[]> = { family: [], shop: [], bank: [] };
    for (const b of map.values()) byKind[b.kind].push(b);

    (Object.keys(byKind) as ExpenseKind[]).forEach((k) =>
        byKind[k].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    );
    return byKind;
}

function recompute(items: Expense[]) {
    const batchesByKind = groupBatches(items);
    const totals: Totals = {
        family: batchesByKind.family.reduce((s, b) => s + b.total, 0),
        shop: batchesByKind.shop.reduce((s, b) => s + b.total, 0),
        bank: batchesByKind.bank.reduce((s, b) => s + b.total, 0),
        all: items.reduce((s, x) => s + fixNum(x.amount ?? fixNum(x.qty) * fixNum(x.price)), 0),
    };
    totals.total = totals.family + totals.shop + totals.bank;
    return { items, batchesByKind, totals };
}

export const useExpensesStore = create<ExpensesState>((set, get) => ({
    loading: false,
    syncing: false,
    online: true,

    items: [],
    batchesByKind: { family: [], shop: [], bank: [] },
    totals: { family: 0, shop: 0, bank: 0, all: 0, total: 0 },

    _ensureNetListener: () => {
        if (NET_LISTENER_SET) return;
        NET_LISTENER_SET = true;

        NetInfo.addEventListener(async (state) => {
            const online = !!state.isConnected && state.isInternetReachable !== false;
            set({ online });
            if (online) {
                try { await get()._flushQueue(); } catch { }
                try { await get().fetchAll(); } catch { }
            }
        });
    },

    _flushQueue: async () => {
        const arr = await readQueue();
        if (!arr.length) return;

        set({ syncing: true });
        const rest: QueueItem[] = [];

        try {
            for (const q of arr) {
                try {
                    if (q.op === "delete") {
                        await api.expenses.deleteBatch(q.batch_id);
                        continue;
                    }

                    // add/edit -> backend replace batch
                    const kind = q.kind;
                    const rowsFixed = q.rows.map((r) => ({
                        client_id: r.client_id ?? uuidLike(),
                        title: (r.title || "").trim(),
                        qty: r.qty == null ? null : fixNum(r.qty),
                        price: r.price == null ? null : fixNum(r.price),
                        amount: fixNum(r.qty) * fixNum(r.price),
                        note: r.note ?? null,
                        created_at: r.created_at ?? new Date().toISOString(),
                    }));

                    await api.expenses.replaceBatch(q.batch_id, {
                        kind,
                        rows: rowsFixed,
                    });

                } catch {
                    rest.push(q);
                }
            }
        } finally {
            await writeQueue(rest);
            set({ syncing: false });
        }
    },

    fetchAll: async () => {
        get()._ensureNetListener();

        if (!get().online) {
            set({ loading: false });
            return;
        }

        set({ loading: true });
        try {
            const r = await api.expenses.list();
            const data = (r.data || []) as any[];

            const items: Expense[] = data.map((x) => ({
                id: x.id,
                batch_id: x.batch_id,
                kind: x.kind,
                title: x.title,
                qty: x.qty == null ? null : Number(x.qty),
                price: x.price == null ? null : Number(x.price),
                amount: Number(x.amount || 0),
                note: x.note ?? null,
                created_at: x.created_at,
                client_id: x.client_id ?? null,
            }));

            set({ ...recompute(items), loading: false });
        } catch {
            set({ loading: false });
        }
    },

    addBatch: async (kind, rows) => {
        const batch_id = uuidLike();
        if (!rows.length) return null;

        const ts = new Date().toISOString();
        const queuedRows: RowQueued[] = rows.map((r) => ({
            title: r.title.trim(),
            qty: fixNum(r.qty),
            price: fixNum(r.price),
            note: r.note,
            client_id: uuidLike(),
            created_at: ts,
        }));

        // optimistic local
        const newItems: Expense[] = [
            ...get().items,
            ...queuedRows.map((r) => ({
                id: uuidLike(),
                client_id: r.client_id!,
                batch_id,
                kind,
                title: r.title,
                qty: r.qty,
                price: r.price,
                amount: r.qty! * r.price!,
                note: r.note ?? null,
                created_at: r.created_at!,
            })),
        ];
        set(recompute(newItems));

        if (!get().online) {
            await pushOp({ op: "add", kind, rows: queuedRows, batch_id });
            return batch_id;
        }

        try {
            await api.expenses.replaceBatch(batch_id, {
                kind,
                rows: queuedRows.map((r) => ({
                    client_id: r.client_id!,
                    title: r.title,
                    qty: fixNum(r.qty),
                    price: fixNum(r.price),
                    amount: fixNum(r.qty) * fixNum(r.price),
                    note: r.note ?? null,
                    created_at: r.created_at!,
                })),
            });
            await get().fetchAll();
        } catch {
            await pushOp({ op: "add", kind, rows: queuedRows, batch_id });
        }

        return batch_id;
    },

    editBatch: async (batch_id, kind, rows) => {
        const ts = new Date().toISOString();
        const queuedRows: RowQueued[] = rows.map((r) => ({
            title: r.title.trim(),
            qty: fixNum(r.qty),
            price: fixNum(r.price),
            note: r.note,
            client_id: uuidLike(),
            created_at: ts,
        }));

        // optimistic local
        const filtered = get().items.filter((x) => x.batch_id !== batch_id);
        const added = queuedRows.map<Expense>((r) => ({
            id: uuidLike(),
            client_id: r.client_id!,
            batch_id,
            kind,
            title: r.title,
            qty: r.qty,
            price: r.price,
            amount: r.qty! * r.price!,
            note: r.note ?? null,
            created_at: r.created_at!,
        }));
        set(recompute([...filtered, ...added]));

        if (!get().online) {
            await pushOp({ op: "edit", kind, rows: queuedRows, batch_id });
            return;
        }

        try {
            await api.expenses.replaceBatch(batch_id, {
                kind,
                rows: queuedRows.map((r) => ({
                    client_id: r.client_id!,
                    title: r.title,
                    qty: fixNum(r.qty),
                    price: fixNum(r.price),
                    amount: fixNum(r.qty) * fixNum(r.price),
                    note: r.note ?? null,
                    created_at: r.created_at!,
                })),
            });
            await get().fetchAll();
        } catch {
            await pushOp({ op: "edit", kind, rows: queuedRows, batch_id });
        }
    },

    deleteBatch: async (batch_id) => {
        // optimistic local
        const filtered = get().items.filter((x) => x.batch_id !== batch_id);
        set(recompute(filtered));

        if (!get().online) {
            await pushOp({ op: "delete", batch_id });
            return;
        }

        try {
            await api.expenses.deleteBatch(batch_id);
            await get().fetchAll();
        } catch {
            await pushOp({ op: "delete", batch_id });
        }
    },

    listBatches: (k) => get().batchesByKind[k],
}));
