// store/appStore.ts
import { getJSON, K, setJSON } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import type { CashReceipt, Category, Product, QueueItem, Ret, Sale, Store } from "@/types";
import { create } from "zustand";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

type AppState = {
    stores: Store[];
    categories: Category[];
    products: Product[];
    sales: Sale[];
    returns: Ret[];
    cashReceipts: CashReceipt[];
    queue: QueueItem[];
    currentStoreId?: string;

    menuOpen: boolean;
    realtimeOn: boolean;
    lastPull?: number;

    _pushTimer?: NodeJS.Timeout | number | null;
    _pushing: boolean;

    init: () => Promise<void>;
    setMenu: (v: boolean) => void;
    setCurrentStore: (id?: string) => void;
    toggleRealtime: () => Promise<void>;
    schedulePush: () => void;

    upsertStore: (s: Omit<Store, "id"> & Partial<Pick<Store, "id">>) => Promise<void>;
    removeStore: (id: string) => Promise<void>;

    upsertCategory: (c: Omit<Category, "id"> & Partial<Pick<Category, "id">>) => Promise<void>;
    removeCategory: (id: string) => Promise<void>;

    upsertProduct: (p: Omit<Product, "id"> & Partial<Pick<Product, "id">>) => Promise<void>;
    removeProduct: (id: string) => Promise<void>;

    addSale: (s: Omit<Sale, "id" | "created_at">) => Promise<void>;
    addReturn: (r: Omit<Ret, "id" | "created_at">) => Promise<void>;

    // Kassa (faqat lokal)
    addCash: (storeId: string, amount: number) => Promise<void>;
    removeCash: (id: string) => Promise<void>;
    updateCash: (id: string, amount: number) => Promise<void>; // ⬅️ qo‘shildi

    // Tarix CRUD (offline first)
    updateSale: (id: string, patch: { qty: number; price: number }) => Promise<void>; // ⬅️ qo‘shildi
    removeSale: (id: string) => Promise<void>; // ⬅️ qo‘shildi
    updateReturn: (id: string, patch: { qty: number; price: number }) => Promise<void>; // ⬅️ qo‘shildi
    removeReturn: (id: string) => Promise<void>; // ⬅️ qo‘shildi

    pushNow: () => Promise<void>;
    pullNow: () => Promise<void>;
    startPull: () => Promise<void>;

    queueStats: () => { stores: number; products: number; sales: number; returns: number };
};

export const useAppStore = create<AppState>()((set, get) => ({
    stores: [],
    categories: [],
    products: [],
    sales: [],
    returns: [],
    cashReceipts: [],
    queue: [],
    menuOpen: false,
    realtimeOn: false,
    lastPull: undefined,
    _pushTimer: null,
    _pushing: false,

    async init() {
        const [stores, cats, products, sales, returns, queue, meta, cash] = await Promise.all([
            getJSON<Store[]>(K.STORES, []),
            getJSON<Category[]>(K.CATEGORIES, []),
            getJSON<Product[]>(K.PRODUCTS, []),
            getJSON<Sale[]>(K.SALES, []),
            getJSON<Ret[]>(K.RETURNS, []),
            getJSON<QueueItem[]>(K.QUEUE, []),
            getJSON<{ lastPull?: number }>(K.META, {}),
            getJSON<CashReceipt[]>(K.CASH, []),
        ]);
        set({ stores, categories: cats, products, sales, returns, queue, lastPull: meta.lastPull, cashReceipts: cash });
        await get().startPull();
        if (queue.length) get().schedulePush();
    },

    setMenu(v) {
        set({ menuOpen: v });
    },
    setCurrentStore(id) {
        set({ currentStoreId: id, menuOpen: false });
    },

    schedulePush() {
        const t = get()._pushTimer;
        if (t) {
            // @ts-ignore
            clearTimeout(t);
        }
        const timer = setTimeout(() => get().pushNow(), 1200);
        set({ _pushTimer: timer });
    },

    async upsertStore(s) {
        const id = s.id ?? `st-${uid()}`;
        const next: Store = { id, type: s.type, name: s.name, prices: s.prices ?? {} };
        const arr = [...get().stores.filter((x) => x.id !== id), next];
        set({ stores: arr });
        await setJSON(K.STORES, arr);

        const q = { id: `q-${uid()}`, type: "store_upsert", payload: next } as unknown as QueueItem;
        const qq = [...get().queue, q];
        set({ queue: qq });
        await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    // removeStore (navbatga delete qo‘shiladi)
    async removeStore(id) {
        const arr = get().stores.filter((s) => s.id !== id);
        set({ stores: arr });
        await setJSON(K.STORES, arr);

        const q = { id: `q-${uid()}`, type: "store_remove", payload: { id } } as unknown as QueueItem;
        const qq = [...get().queue, q];
        set({ queue: qq });
        await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async upsertCategory(c) {
        const id = c.id ?? `cat-${uid()}`;
        const next: Category = { id, name: c.name };
        const arr = [...get().categories.filter((x) => x.id !== id), next];
        set({ categories: arr });
        await setJSON(K.CATEGORIES, arr);
    },
    async removeCategory(id) {
        const arr = get().categories.filter((c) => c.id !== id);
        set({ categories: arr });
        await setJSON(K.CATEGORIES, arr);
    },

    async upsertProduct(p) {
        const id = p.id ?? `pr-${uid()}`;
        const next: Product = { id, name: p.name, priceBranch: p.priceBranch, priceMarket: p.priceMarket };
        const arr = [...get().products.filter((x) => x.id !== id), next];
        set({ products: arr });
        await setJSON(K.PRODUCTS, arr);

        const q = { id: `q-${uid()}`, type: "product_upsert", payload: next } as unknown as QueueItem;
        const qq = [...get().queue, q];
        set({ queue: qq });
        await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async removeProduct(id) {
        const arr = get().products.filter((p) => p.id !== id);
        set({ products: arr });
        await setJSON(K.PRODUCTS, arr);

        const q = { id: `q-${uid()}`, type: "product_remove", payload: { id } } as unknown as QueueItem;
        const qq = [...get().queue, q];
        set({ queue: qq });
        await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async addSale(s) {
        const item: Sale = {
            id: `sa-${uid()}`,
            created_at: Date.now(),
            ...s, // s ichida batchId bo‘lishi mumkin
        };
        const arr = [...get().sales, item];
        set({ sales: arr }); await setJSON(K.SALES, arr);
        const q: QueueItem = { id: `q-${uid()}`, type: "sale_create", payload: item };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async addReturn(r) {
        const item: Ret = { id: `rt-${uid()}`, created_at: Date.now(), ...r };
        const arr = [...get().returns, item];
        set({ returns: arr });
        await setJSON(K.RETURNS, arr);

        const q = { id: `q-${uid()}`, type: "return_create", payload: item } as unknown as QueueItem;
        const qq = [...get().queue, q];
        set({ queue: qq });
        await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async addCash(storeId, amount) {
        const item: CashReceipt = { id: `cr-${uid()}`, storeId, amount, created_at: Date.now() };
        const arr = [...get().cashReceipts, item];
        set({ cashReceipts: arr });
        await setJSON(K.CASH, arr);
    },
    async removeCash(id) {
        const arr = get().cashReceipts.filter((x) => x.id !== id);
        set({ cashReceipts: arr });
        await setJSON(K.CASH, arr);
    },
    async updateCash(id, amount) {
        const arr = get().cashReceipts.map((x) => (x.id === id ? { ...x, amount } : x));
        set({ cashReceipts: arr });
        await setJSON(K.CASH, arr);
    },

    // === Tarix CRUD ===
    async updateSale(id, patch) {
        const arr = get().sales.map((s) => (s.id === id ? { ...s, qty: patch.qty, price: patch.price } : s));
        set({ sales: arr });
        await setJSON(K.SALES, arr);

        const q = { id: `q-${uid()}`, type: "sale_update", payload: { id, qty: patch.qty, price: patch.price } } as unknown as QueueItem;
        const qq = [...get().queue, q];
        set({ queue: qq });
        await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async removeSale(id) {
        const arr = get().sales.filter((s) => s.id !== id);
        set({ sales: arr });
        await setJSON(K.SALES, arr);

        const q = { id: `q-${uid()}`, type: "sale_remove", payload: { id } } as unknown as QueueItem;
        const qq = [...get().queue, q];
        set({ queue: qq });
        await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async updateReturn(id, patch) {
        const arr = get().returns.map((r) => (r.id === id ? { ...r, qty: patch.qty, price: patch.price } : r));
        set({ returns: arr });
        await setJSON(K.RETURNS, arr);

        const q = { id: `q-${uid()}`, type: "return_update", payload: { id, qty: patch.qty, price: patch.price } } as unknown as QueueItem;
        const qq = [...get().queue, q];
        set({ queue: qq });
        await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async removeReturn(id) {
        const arr = get().returns.filter((r) => r.id !== id);
        set({ returns: arr });
        await setJSON(K.RETURNS, arr);

        const q = { id: `q-${uid()}`, type: "return_remove", payload: { id } } as unknown as QueueItem;
        const qq = [...get().queue, q];
        set({ queue: qq });
        await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    queueStats() {
        const q = get().queue;
        return {
            stores: q.filter((x) => x.type === "store_upsert").length,
            products: q.filter((x) => x.type === "product_upsert").length,
            sales: q.filter((x) => x.type === "sale_create").length,
            returns: q.filter((x) => x.type === "return_create").length,
        };
    },

    async pushNow() {
        if (get()._pushing) return;
        set({ _pushing: true });

        const q = [...(get().queue as any[])]; // any[] qilib, yangi tiplarda ham TS xato bermasin
        const rest: QueueItem[] = [];

        for (const it of q) {
            try {
                if (it.type === "store_upsert") {
                    const p = it.payload;
                    const { error } = await supabase.from("stores").upsert({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        prices: p.prices,
                    });
                    if (error) throw error;

                } else if (it.type === "product_upsert") {
                    const p = it.payload;
                    const { error } = await supabase.from("products").upsert({
                        id: p.id,
                        name: p.name,
                        price_branch: p.priceBranch ?? null,
                        price_market: p.priceMarket ?? null,
                    });
                    if (error) throw error;

                } else if (it.type === "sale_create") {
                    const s = it.payload;
                    const { error } = await supabase.from("sales").insert({
                        id: s.id,
                        store_id: s.storeId,
                        product_name: s.productName,
                        qty: s.qty,
                        unit: s.unit,
                        price: s.price,
                        batch_id: s.batchId ?? null, // ⬅️
                        created_at: new Date(s.created_at).toISOString(),
                    });
                    if (error) throw error;

                } else if (it.type === "return_create") {
                    const r = it.payload;
                    const { error } = await supabase.from("returns").insert({
                        id: r.id,
                        store_id: r.storeId,
                        product_name: r.productName,
                        qty: r.qty,
                        unit: r.unit,
                        price: r.price,
                        created_at: new Date(r.created_at).toISOString(),
                    });
                    if (error) throw error;

                } else if (it.type === "product_remove") {
                    const { id } = it.payload;
                    const { error } = await supabase.from("products").delete().eq("id", id);
                    if (error) throw error;

                } else if (it.type === "store_remove") {
                    const { id } = it.payload;
                    const { error } = await supabase.from("stores").delete().eq("id", id);
                    if (error) throw error;

                    // === Tarix CRUD CASE-lari ===
                } else if (it.type === "sale_update") {
                    const { id, qty, price } = it.payload;
                    const { error } = await supabase.from("sales").update({ qty, price }).eq("id", id);
                    if (error) throw error;

                } else if (it.type === "sale_remove") {
                    const { id } = it.payload;
                    const { error } = await supabase.from("sales").delete().eq("id", id);
                    if (error) throw error;

                } else if (it.type === "return_update") {
                    const { id, qty, price } = it.payload;
                    const { error } = await supabase.from("returns").update({ qty, price }).eq("id", id);
                    if (error) throw error;

                } else if (it.type === "return_remove") {
                    const { id } = it.payload;
                    const { error } = await supabase.from("returns").delete().eq("id", id);
                    if (error) throw error;
                }
            } catch {
                // Offline yoki RLS xatosi — keyinroq yana urinamiz
                rest.push(it as QueueItem);
            }
        }

        set({ queue: rest, _pushing: false });
        await setJSON(K.QUEUE, rest);
        if (rest.length) get().schedulePush();
    }, // ⬅️ MUHIM: shu vergul pushNow'dan keyin BO‘LISHI SHART!

    async pullNow() {
        const [st, pr, sa, re] = await Promise.all([
            supabase.from("stores").select("*"),
            supabase.from("products").select("*"),
            supabase.from("sales").select("*").order("created_at", { ascending: true }),
            supabase.from("returns").select("*").order("created_at", { ascending: true }),
        ]);

        if (st.data) {
            const stores: Store[] = st.data.map((x: any) => ({
                id: x.id,
                name: x.name,
                type: x.type,
                prices: x.prices || {},
            }));
            set({ stores });
            await setJSON(K.STORES, stores);
        }
        if (pr.data) {
            const products: Product[] = pr.data.map((x: any) => ({
                id: x.id,
                name: x.name,
                priceBranch: x.price_branch ?? undefined,
                priceMarket: x.price_market ?? undefined,
            }));
            set({ products });
            await setJSON(K.PRODUCTS, products);
        }
        if (sa.data) {
            const sales: Sale[] = sa.data.map((x: any) => ({
                id: x.id,
                storeId: x.store_id,
                productName: x.product_name,
                qty: x.qty,
                unit: x.unit,
                price: x.price,
                created_at: new Date(x.created_at).getTime(),
                batchId: x.batch_id ?? undefined, // ⬅️
            }));
            set({ sales }); await setJSON(K.SALES, sales);
        }
        if (re.data) {
            const returns: Ret[] = re.data.map((x: any) => ({
                id: x.id,
                storeId: x.store_id,
                productName: x.product_name,
                qty: x.qty,
                unit: x.unit,
                price: x.price,
                created_at: new Date(x.created_at).getTime(),
            }));
            set({ returns });
            await setJSON(K.RETURNS, returns);
        }
        const lastPull = Date.now();
        set({ lastPull });
        await setJSON(K.META, { lastPull });
    },

    async startPull() {
        if (get().realtimeOn) return;
        set({ realtimeOn: true });

        supabase
            .channel("ch-stores")
            .on("postgres_changes", { event: "*", schema: "public", table: "stores" }, () => get().pullNow())
            .subscribe();

        supabase
            .channel("ch-products")
            .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => get().pullNow())
            .subscribe();

        supabase
            .channel("ch-sales")
            .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => get().pullNow())
            .subscribe();

        supabase
            .channel("ch-returns")
            .on("postgres_changes", { event: "*", schema: "public", table: "returns" }, () => get().pullNow())
            .subscribe();

        await get().pullNow();
    },

    async toggleRealtime() {
        const on = get().realtimeOn;
        if (on) {
            supabase.removeAllChannels();
            set({ realtimeOn: false });
        } else {
            await get().startPull();
        }
    },
}));
