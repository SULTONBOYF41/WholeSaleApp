// store/expensesStore.ts
import { supabase } from "@/lib/supabase";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";

/** --- TURLAR --- */
export type ExpenseKind = "family" | "shop" | "bank";

export interface Expense {
    id: string;            // db id (uuid)
    batch_id: string;      // bir paketning ID'si
    kind: ExpenseKind;
    title: string;
    qty: number | null;
    price: number | null;
    amount: number;        // qty * price (serverda ham hisoblanadi)
    note?: string | null;
    created_at: string;    // ISO
    client_id?: string | null; // upsert onConflict uchun UQ
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

    items: Expense[]; // flatten qatorlar
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

/** --- ICHKI YORDAMChILAR --- */
const QKEY = "expenses_queue_v1";
let NET_LISTENER_SET = false;
let REALTIME_SET = false;
let REFRESH_TIMER: any = null;
let QUEUE_DRAINER: any = null;

function uuidLike() {
    const rnd = (len: number) =>
        Array.from({ length: len }, () => Math.floor(Math.random() * 16).toString(16)).join("");
    return `${rnd(8)}-${rnd(4)}-${rnd(4)}-${rnd(4)}-${rnd(12)}`;
}
function fixNum(n: any): number {
    const v = Number(n);
    return Number.isFinite(v) ? v : 0;
}
function logDbError(tag: string, error: any) {
    console.error(`[expenses:${tag}]`, error?.message || error);
}

async function pushOp(op: QueueItem) {
    const raw = (await AsyncStorage.getItem(QKEY)) ?? "[]";
    const arr = JSON.parse(raw) as QueueItem[];
    arr.push(op);
    await AsyncStorage.setItem(QKEY, JSON.stringify(arr));
}
async function readQueue(): Promise<QueueItem[]> {
    const raw = (await AsyncStorage.getItem(QKEY)) ?? "[]";
    try {
        return JSON.parse(raw) as QueueItem[];
    } catch {
        return [];
    }
}
async function writeQueue(arr: QueueItem[]) {
    await AsyncStorage.setItem(QKEY, JSON.stringify(arr));
}
async function getQueueCount(): Promise<number> {
    return (await readQueue()).length;
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

        // serverdan kelgan amount bo'lsa shuni ustuvor olamiz, bo'lmasa qty*price:
        const a = fixNum(it.amount ?? fixNum(it.qty) * fixNum(it.price));
        b.total += a;

        // batch created_at — eng erta vaqt bo‘lsin
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

/** --- STORE --- */
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
                try {
                    await get()._flushQueue();
                } catch { }
                try {
                    await get().fetchAll();
                } catch { }
            }
        });
    },

    _ensureRealtime: () => {
        if (!REALTIME_SET) {
            REALTIME_SET = true;
            supabase
                .channel("public:expenses")
                .on(
                    "postgres_changes",
                    { event: "*", schema: "public", table: "expenses" },
                    () => {
                        // kichik debounce
                        if (REFRESH_TIMER) clearTimeout(REFRESH_TIMER);
                        REFRESH_TIMER = setTimeout(() => {
                            get()
                                .fetchAll()
                                .catch(() => { });
                        }, 400);
                    }
                )
                .subscribe();
        }

        if (!QUEUE_DRAINER) {
            QUEUE_DRAINER = setInterval(async () => {
                const st = get();
                if (!st.online) return;
                const qn = await getQueueCount();
                if (qn > 0) {
                    st._flushQueue().catch(() => { });
                }
            }, 10000);
        }
    },

    _flushQueue: async () => {
        const arr = await readQueue();
        if (!arr.length) return;
        set({ syncing: true });
        try {
            for (const q of arr) {
                if (q.op === "add" || q.op === "edit") {
                    if (q.op === "edit") {
                        const del = await supabase.from("expenses").delete().eq("batch_id", q.batch_id);
                        if (del.error) {
                            logDbError("flush.edit.delete", del.error);
                            continue; // keyingisiga o‘tamiz (queue tozalashni to‘xtatmaymiz)
                        }
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
                    const ins = await supabase.from("expenses").upsert(payload, { onConflict: "client_id" }).select();
                    if (ins.error) logDbError("flush.upsert", ins.error);
                } else if (q.op === "delete") {
                    const del = await supabase.from("expenses").delete().eq("batch_id", q.batch_id);
                    if (del.error) logDbError("flush.delete", del.error);
                }
            }
            await writeQueue([]); // tozalaymiz
        } finally {
            set({ syncing: false });
        }
    },

    fetchAll: async () => {
        get()._ensureNetListener();
        get()._ensureRealtime();

        // offline’da serverga urilmaymiz, lekin loading false qilamiz
        if (!get().online) {
            set({ loading: false });
            return;
        }

        set({ loading: true });
        const { data, error } = await supabase
            .from("expenses")
            .select("id,batch_id,kind,title,qty,price,amount,note,created_at,client_id")
            .order("created_at", { ascending: false });

        if (error || !data) {
            if (error) logDbError("fetchAll", error);
            set({ loading: false });
            return;
        }

        const items = data as Expense[];
        set({ ...recompute(items), loading: false });
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
            // offline: queue + optimistik
            await pushOp({ op: "add", kind, rows: queuedRows, batch_id });
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
                    amount: r.qty * r.price,
                    note: r.note ?? null,
                    created_at: r.created_at!,
                })),
            ];
            set(recompute(newItems));
            return batch_id;
        }

        // online: bevosita upsert
        const payload = queuedRows.map((r) => ({
            client_id: r.client_id!,
            batch_id,
            kind,
            title: r.title,
            qty: r.qty,
            price: r.price,
            amount: r.qty * r.price,
            note: r.note ?? null,
            created_at: r.created_at!,
        }));

        const ins = await supabase.from("expenses").upsert(payload, { onConflict: "client_id" }).select();
        if (ins.error) {
            logDbError("addBatch.upsert", ins.error);
            // fallback: queue + optimistik
            await pushOp({ op: "add", kind, rows: queuedRows, batch_id });
            const newItems = [
                ...get().items,
                ...payload.map((p) => ({ ...p, id: uuidLike() } as Expense)),
            ];
            set(recompute(newItems));
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
                batch_id,
                kind,
                title: r.title,
                qty: r.qty,
                price: r.price,
                amount: r.qty * r.price,
                note: r.note ?? null,
                created_at: r.created_at!,
            }));
            set(recompute([...filtered, ...added]));
            return;
        }

        const del = await supabase.from("expenses").delete().eq("batch_id", batch_id);
        if (del.error) {
            logDbError("editBatch.delete", del.error);
            // fallback: queue + optimistik
            await pushOp({ op: "edit", kind, rows: queuedRows, batch_id });
            const filtered = get().items.filter((x) => x.batch_id !== batch_id);
            const added = queuedRows.map<Expense>((r) => ({
                id: uuidLike(),
                client_id: r.client_id!,
                batch_id,
                kind,
                title: r.title,
                qty: r.qty,
                price: r.price,
                amount: r.qty * r.price,
                note: r.note ?? null,
                created_at: r.created_at!,
            }));
            set(recompute([...filtered, ...added]));
            return;
        }

        const payload = queuedRows.map((r) => ({
            client_id: r.client_id!,
            batch_id,
            kind,
            title: r.title,
            qty: r.qty,
            price: r.price,
            amount: r.qty * r.price,
            note: r.note ?? null,
            created_at: r.created_at!,
        }));
        const ins = await supabase.from("expenses").upsert(payload, { onConflict: "client_id" }).select();
        if (ins.error) {
            logDbError("editBatch.upsert", ins.error);
            await pushOp({ op: "edit", kind, rows: queuedRows, batch_id });
            const filtered = get().items.filter((x) => x.batch_id !== batch_id);
            const added = payload.map<Expense>((p) => ({ ...p, id: uuidLike() } as Expense));
            set(recompute([...filtered, ...added]));
        } else {
            await get().fetchAll();
        }
    },

    deleteBatch: async (batch_id) => {
        if (!get().online) {
            await pushOp({ op: "delete", batch_id });
            const filtered = get().items.filter((x) => x.batch_id !== batch_id);
            set(recompute(filtered));
            return;
        }

        const del = await supabase.from("expenses").delete().eq("batch_id", batch_id).select();
        if (del.error) {
            logDbError("deleteBatch", del.error);
            await pushOp({ op: "delete", batch_id });
            const filtered = get().items.filter((x) => x.batch_id !== batch_id);
            set(recompute(filtered));
        } else {
            await get().fetchAll();
        }
    },

    listBatches: (k) => get().batchesByKind[k],
}));
