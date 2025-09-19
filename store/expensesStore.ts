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
    client_id?: string | null;
}

export type RowInput = { title: string; qty: number; price: number; note?: string };

export interface ExpenseBatch {
    id: string; // == batch_id
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
    _ensureRealtime: () => void;
    _flushQueue: () => Promise<void>;
}

const QKEY = "expenses_queue_v1";
let NET_LISTENER_SET = false;
let REALTIME_SET = false;
let REFRESH_TIMER: any = null;
let QUEUE_DRAINER: any = null;

function uuidLike() {
    const rnd = (len: number) => Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return `${rnd(8)}-${rnd(4)}-${rnd(4)}-${rnd(4)}-${rnd(12)}`;
}
function fixNum(n: any): number { const v = Number(n); return Number.isFinite(v) ? v : 0; }

async function pushOp(op: QueueItem) {
    const raw = (await AsyncStorage.getItem(QKEY)) ?? "[]";
    const arr = JSON.parse(raw) as QueueItem[];
    arr.push(op);
    await AsyncStorage.setItem(QKEY, JSON.stringify(arr));
}
async function getQueueCount(): Promise<number> {
    const raw = (await AsyncStorage.getItem(QKEY)) ?? "[]";
    try { return (JSON.parse(raw) as any[]).length; } catch { return 0; }
}

function groupBatches(items: Expense[]): Record<ExpenseKind, ExpenseBatch[]> {
    const map = new Map<string, ExpenseBatch>();
    for (const it of items) {
        if (!map.has(it.batch_id)) {
            map.set(it.batch_id, { id: it.batch_id, kind: it.kind, created_at: it.created_at, total: 0, items: [] });
        }
        const b = map.get(it.batch_id)!;
        b.items.push(it);
        const a = fixNum(it.amount ?? fixNum(it.qty) * fixNum(it.price));
        b.total += a;
        if (new Date(it.created_at) < new Date(b.created_at)) b.created_at = it.created_at;
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
            // devda isInternetReachable null bo'lsa ham isConnected asosiy
            const online = !!state.isConnected && (state.isInternetReachable !== false);
            set({ online });
            if (online) {
                await get()._flushQueue();
                await get().fetchAll();
            }
        });
    },

    _ensureRealtime: () => {
        if (REALTIME_SET) {
            return;
        }
        REALTIME_SET = true;
        supabase
            .channel("public:expenses")
            .on("postgres_changes", { event: "*", schema: "public", table: "expenses" }, () => {
                if (REFRESH_TIMER) clearTimeout(REFRESH_TIMER);
                REFRESH_TIMER = setTimeout(() => { get().fetchAll().catch(() => { }); }, 400);
            })
            .subscribe();

        if (!QUEUE_DRAINER) {
            QUEUE_DRAINER = setInterval(async () => {
                const st = get();
                if (!st.online) return;
                const qn = await getQueueCount();
                if (qn > 0) st._flushQueue().catch(() => { });
            }, 10000);
        }
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
                    const rowsFixed = q.rows.map((r) => ({
                        ...r,
                        client_id: r.client_id ?? uuidLike(),
                        created_at: r.created_at ?? new Date().toISOString(),
                    }));
                    const payload = rowsFixed.map((r) => ({
                        client_id: r.client_id!,
                        batch_id: q.batch_id,
                        kind: q.kind,
                        title: r.title,
                        qty: fixNum(r.qty),
                        price: fixNum(r.price),
                        amount: fixNum(r.qty) * fixNum(r.price),
                        note: r.note ?? null,
                        created_at: r.created_at!,
                    }));
                    await supabase.from("expenses").upsert(payload, { onConflict: "client_id" });
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
        // 👉 offline’da tarmoqqa urilmaymiz
        if (!get().online) { set({ loading: false }); return; }

        set({ loading: true });
        const { data, error } = await supabase
            .from("expenses")
            .select("id,batch_id,kind,title,qty,price,amount,note,created_at,client_id")
            .order("created_at", { ascending: false });

        if (error || !data) { set({ loading: false }); return; }

        const items = data as Expense[];
        const next = recompute(items);
        set({ ...next, loading: false });
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

        if (!get().online) {
            // 👉 offline: queue + optimistik lokal yangilash
            await pushOp({ op: "add", kind, rows: queuedRows, batch_id });
            const newItems: Expense[] = [
                ...get().items,
                ...queuedRows.map((r) => ({
                    id: uuidLike(),
                    client_id: r.client_id!,
                    batch_id, kind,
                    title: r.title,
                    qty: r.qty, price: r.price,
                    amount: r.qty * r.price,
                    note: r.note ?? null,
                    created_at: r.created_at!,
                })),
            ];
            const next = recompute(newItems);
            set(next);
            return batch_id;
        }

        // online: bevosita upsert
        const payload = queuedRows.map((r) => ({
            client_id: r.client_id!,
            batch_id, kind,
            title: r.title,
            qty: r.qty,
            price: r.price,
            amount: r.qty * r.price,
            note: r.note ?? null,
            created_at: r.created_at!,
        }));
        const { error } = await supabase.from("expenses").upsert(payload, { onConflict: "client_id" });
        if (error) {
            // fallback: queue + optimistik
            await pushOp({ op: "add", kind, rows: queuedRows, batch_id });
            const newItems = [
                ...get().items,
                ...payload.map((p) => ({
                    ...p,
                    id: uuidLike(),
                } as Expense)),
            ];
            const next = recompute(newItems);
            set(next);
        } else {
            await get().fetchAll();
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

        if (!get().online) {
            await pushOp({ op: "edit", kind, rows: queuedRows, batch_id });
            // optimistik: eski batchni olib tashlab, yangisini qo'shamiz
            const filtered = get().items.filter((x) => x.batch_id !== batch_id);
            const added = queuedRows.map<Expense>((r) => ({
                id: uuidLike(),
                client_id: r.client_id!,
                batch_id, kind,
                title: r.title,
                qty: r.qty, price: r.price,
                amount: r.qty * r.price,
                note: r.note ?? null,
                created_at: r.created_at!,
            }));
            const next = recompute([...filtered, ...added]);
            set(next);
            return;
        }

        await supabase.from("expenses").delete().eq("batch_id", batch_id);
        const payload = queuedRows.map((r) => ({
            client_id: r.client_id!,
            batch_id, kind,
            title: r.title, qty: r.qty, price: r.price,
            amount: r.qty * r.price, note: r.note ?? null,
            created_at: r.created_at!,
        }));
        const { error } = await supabase.from("expenses").upsert(payload, { onConflict: "client_id" });
        if (error) {
            await pushOp({ op: "edit", kind, rows: queuedRows, batch_id });
            const filtered = get().items.filter((x) => x.batch_id !== batch_id);
            const added = payload.map<Expense>((p) => ({ ...p, id: uuidLike() } as Expense));
            const next = recompute([...filtered, ...added]);
            set(next);
        } else {
            await get().fetchAll();
        }
    },

    deleteBatch: async (batch_id) => {
        if (!get().online) {
            await pushOp({ op: "delete", batch_id });
            const filtered = get().items.filter((x) => x.batch_id !== batch_id);
            const next = recompute(filtered);
            set(next);
            return;
        }

        const { error } = await supabase.from("expenses").delete().eq("batch_id", batch_id);
        if (error) {
            await pushOp({ op: "delete", batch_id });
            const filtered = get().items.filter((x) => x.batch_id !== batch_id);
            const next = recompute(filtered);
            set(next);
        } else {
            await get().fetchAll();
        }
    },

    listBatches: (k) => get().batchesByKind[k],
}));
