// store/expensesStore.ts
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";

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
}

export type RowInput = { title: string; qty: number; price: number; note?: string };

export interface ExpenseBatch {
    id: string; // == batch_id
    kind: ExpenseKind;
    created_at: string;
    total: number;
    items: Expense[];
}

type Totals = { family: number; shop: number; bank: number; all: number };

type QueueItem =
    | { op: "add"; kind: ExpenseKind; rows: RowInput[]; batch_id: string }
    | { op: "edit"; kind: ExpenseKind; rows: RowInput[]; batch_id: string }
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

    // internal
    _ensureNetListener: () => void;
    _ensureRealtime: () => void;
    _flushQueue: () => Promise<void>;
}

const QKEY = "expenses_queue_v1";
let NET_LISTENER_SET = false;
let REALTIME_SET = false;
let REFRESH_TIMER: any = null;

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
        const a = Number(it.amount ?? (Number(it.qty ?? 0) * Number(it.price ?? 0)));
        b.total += a;
        if (new Date(it.created_at) < new Date(b.created_at)) b.created_at = it.created_at;
    }
    const byKind: Record<ExpenseKind, ExpenseBatch[]> = { family: [], shop: [], bank: [] };
    for (const b of map.values()) byKind[b.kind].push(b);
    (Object.keys(byKind) as ExpenseKind[]).forEach(k =>
        byKind[k].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
    );
    return byKind;
}

async function pushOp(op: QueueItem) {
    const raw = (await AsyncStorage.getItem(QKEY)) ?? "[]";
    const arr = JSON.parse(raw) as QueueItem[];
    arr.push(op);
    await AsyncStorage.setItem(QKEY, JSON.stringify(arr));
}

function uuidLike() {
    const rnd = (len: number) => Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return `${rnd(8)}-${rnd(4)}-${rnd(4)}-${rnd(4)}-${rnd(12)}`;
}

export const useExpensesStore = create<ExpensesState>((set, get) => ({
    loading: false,
    syncing: false,
    online: true,
    items: [],
    batchesByKind: { family: [], shop: [], bank: [] },
    totals: { family: 0, shop: 0, bank: 0, all: 0 },

    _ensureNetListener: () => {
        if (NET_LISTENER_SET) return;
        NET_LISTENER_SET = true;
        NetInfo.addEventListener(async (state) => {
            const online = !!state.isConnected && !!state.isInternetReachable;
            set({ online });
            if (online) {
                await get()._flushQueue();
                await get().fetchAll();
            }
        });
    },

    _ensureRealtime: () => {
        if (REALTIME_SET) return;
        REALTIME_SET = true;
        const ch = supabase
            .channel("public:expenses")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "expenses" },
                () => {
                    // Debounce refresh
                    if (REFRESH_TIMER) clearTimeout(REFRESH_TIMER);
                    REFRESH_TIMER = setTimeout(() => {
                        get().fetchAll();
                    }, 400);
                }
            )
            .subscribe();
    },

    _flushQueue: async () => {
        const raw = (await AsyncStorage.getItem(QKEY)) ?? "[]";
        const arr = JSON.parse(raw) as QueueItem[];
        if (!arr.length) return;
        set({ syncing: true });
        try {
            for (const q of arr) {
                if (q.op === "add" || q.op === "edit") {
                    if (q.op === "edit") {
                        await supabase.from("expenses").delete().eq("batch_id", q.batch_id);
                    }
                    const rows = q.rows.map((r) => ({
                        batch_id: q.batch_id,
                        kind: q.kind,
                        title: r.title,
                        qty: r.qty,
                        price: r.price,
                        amount: r.qty * r.price,
                        note: r.note ?? null,
                    }));
                    await supabase.from("expenses").insert(rows);
                } else if (q.op === "delete") {
                    await supabase.from("expenses").delete().eq("batch_id", q.batch_id);
                }
            }
            await AsyncStorage.setItem(QKEY, "[]");
        } finally {
            set({ syncing: false });
        }
    },

    fetchAll: async () => {
        get()._ensureNetListener();
        get()._ensureRealtime();
        set({ loading: true });
        const { data, error } = await supabase
            .from("expenses")
            .select("id,batch_id,kind,title,qty,price,amount,note,created_at")
            .order("created_at", { ascending: false });
        if (error || !data) { set({ loading: false }); return; }
        const items = data as Expense[];
        const batchesByKind = groupBatches(items);
        const totals = {
            family: batchesByKind.family.reduce((s, b) => s + b.total, 0),
            shop: batchesByKind.shop.reduce((s, b) => s + b.total, 0),
            bank: batchesByKind.bank.reduce((s, b) => s + b.total, 0),
            all: items.reduce((s, x) => s + Number(x.amount ?? (Number(x.qty ?? 0) * Number(x.price ?? 0))), 0),
        };
        set({ items, batchesByKind, totals, loading: false });
    },

    addBatch: async (kind, rows) => {
        const batch_id = uuidLike();
        const online = get().online;
        if (!rows.length) return null;

        if (online) {
            const payload = rows.map(r => ({
                batch_id, kind,
                title: r.title, qty: r.qty, price: r.price,
                amount: r.qty * r.price, note: r.note ?? null,
            }));
            const { error } = await supabase.from("expenses").insert(payload);
            if (error) await pushOp({ op: "add", kind, rows, batch_id });
        } else {
            await pushOp({ op: "add", kind, rows, batch_id });
        }

        await get().fetchAll();
        return batch_id;
    },

    editBatch: async (batch_id, kind, rows) => {
        const online = get().online;
        if (online) {
            await supabase.from("expenses").delete().eq("batch_id", batch_id);
            const payload = rows.map(r => ({
                batch_id, kind,
                title: r.title, qty: r.qty, price: r.price,
                amount: r.qty * r.price, note: r.note ?? null,
            }));
            await supabase.from("expenses").insert(payload);
        } else {
            await pushOp({ op: "edit", kind, rows, batch_id });
        }
        await get().fetchAll();
    },

    deleteBatch: async (batch_id) => {
        const online = get().online;
        if (online) {
            await supabase.from("expenses").delete().eq("batch_id", batch_id);
        } else {
            await pushOp({ op: "delete", batch_id });
        }
        await get().fetchAll();
    },

    listBatches: (k) => get().batchesByKind[k],
}));
