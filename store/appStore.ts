// store/appStore.ts
import { getJSON, K, setJSON } from "@/lib/storage";
import { api } from "@/lib/api";
import type { CashReceipt, Category, Product, Ret, Sale, Store } from "@/types";
import { create } from "zustand";

const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

type QueueItem =
    | { id: string; type: "store_upsert"; payload: Store }
    | { id: string; type: "store_remove"; payload: { id: string } }
    | { id: string; type: "product_upsert"; payload: Product }
    | { id: string; type: "product_remove"; payload: { id: string } }
    | { id: string; type: "sale_create"; payload: Sale }
    | { id: string; type: "sale_update"; payload: { id: string; qty: number; price: number } }
    | { id: string; type: "sale_remove"; payload: { id: string } }
    | { id: string; type: "return_create"; payload: Ret }
    | { id: string; type: "return_update"; payload: { id: string; qty: number; price: number } }
    | { id: string; type: "return_remove"; payload: { id: string } }
    | { id: string; type: "cash_create"; payload: CashReceipt }
    | { id: string; type: "cash_update"; payload: { id: string; amount: number } }
    | { id: string; type: "cash_remove"; payload: { id: string } };

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
    realtimeOn: boolean; // endi realtime yo‘q, flag sifatida qoldiramiz
    lastPull?: number;

    _pushTimer?: any;
    _pushing: boolean;

    init: () => Promise<void>;
    setMenu: (v: boolean) => void;
    setCurrentStore: (id?: string) => void;

    // Old API compat:
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

    addCash: (storeId: string, amount: number) => Promise<void>;
    removeCash: (id: string) => Promise<void>;
    updateCash: (id: string, amount: number) => Promise<void>;

    updateSale: (id: string, patch: { qty: number; price: number }) => Promise<void>;
    removeSale: (id: string) => Promise<void>;
    updateReturn: (id: string, patch: { qty: number; price: number }) => Promise<void>;
    removeReturn: (id: string) => Promise<void>;

    pushNow: () => Promise<void>;
    pullNow: () => Promise<void>;
    startPull: () => Promise<void>;

    queueStats: () => { stores: number; products: number; sales: number; returns: number; cash: number };
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

        // iloji bo‘lsa bir marta snapshot olamiz
        await get().startPull();

        if (queue.length) get().schedulePush();
    },

    setMenu(v) { set({ menuOpen: v }); },
    setCurrentStore(id) { set({ currentStoreId: id, menuOpen: false }); },

    async toggleRealtime() {
        // Supabase realtime yo‘q. Faqat flag.
        set({ realtimeOn: !get().realtimeOn });
    },

    schedulePush() {
        const t = get()._pushTimer;
        if (t) clearTimeout(t as any);
        const timer = setTimeout(() => get().pushNow(), 1200);
        set({ _pushTimer: timer });
    },

    async upsertStore(s) {
        const id = s.id ?? `st-${uid()}`;
        const next: Store = { id, type: s.type, name: s.name, prices: (s as any).prices ?? {} };
        const arr = [...get().stores.filter(x => x.id !== id), next];
        set({ stores: arr }); await setJSON(K.STORES, arr);

        const q: QueueItem = { id: `q-${uid()}`, type: "store_upsert", payload: next };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async removeStore(id) {
        const arr = get().stores.filter(s => s.id !== id);
        set({ stores: arr }); await setJSON(K.STORES, arr);

        const q: QueueItem = { id: `q-${uid()}`, type: "store_remove", payload: { id } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async upsertCategory(c) {
        const id = c.id ?? `cat-${uid()}`;
        const next: Category = { id, name: c.name };
        const arr = [...get().categories.filter(x => x.id !== id), next];
        set({ categories: arr }); await setJSON(K.CATEGORIES, arr);
    },

    async removeCategory(id) {
        const arr = get().categories.filter(c => c.id !== id);
        set({ categories: arr }); await setJSON(K.CATEGORIES, arr);
    },

    async upsertProduct(p) {
        const id = p.id ?? `pr-${uid()}`;
        const next: Product = {
            id,
            name: p.name,
            categoryId: (p as any).categoryId ?? (p as any).category_id ?? undefined,
            priceBranch: p.priceBranch,
            priceMarket: p.priceMarket,
        };

        const arr = [...get().products.filter(x => x.id !== id), next];
        set({ products: arr }); await setJSON(K.PRODUCTS, arr);

        const q: QueueItem = { id: `q-${uid()}`, type: "product_upsert", payload: next };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async removeProduct(id) {
        const arr = get().products.filter(p => p.id !== id);
        set({ products: arr }); await setJSON(K.PRODUCTS, arr);

        const q: QueueItem = { id: `q-${uid()}`, type: "product_remove", payload: { id } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async addSale(s) {
        const storeName = get().stores.find(st => String(st.id) === String(s.storeId))?.name ?? undefined;

        const item: Sale = {
            id: `sa-${uid()}`,
            created_at: Date.now(),
            storeName,
            ...s,
        };

        const arr = [...get().sales, item];
        set({ sales: arr }); await setJSON(K.SALES, arr);

        const q: QueueItem = { id: `q-${uid()}`, type: "sale_create", payload: item };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async addReturn(r) {
        const storeName = get().stores.find(st => String(st.id) === String(r.storeId))?.name ?? undefined;

        const item: Ret = {
            id: `rt-${uid()}`,
            created_at: Date.now(),
            storeName,
            ...r,
        };

        const arr = [...get().returns, item];
        set({ returns: arr }); await setJSON(K.RETURNS, arr);

        const q: QueueItem = { id: `q-${uid()}`, type: "return_create", payload: item };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async addCash(storeId, amount) {
        const item: CashReceipt = { id: `cr-${uid()}`, storeId, amount, created_at: Date.now() } as any;
        const arr = [...get().cashReceipts, item];
        set({ cashReceipts: arr }); await setJSON(K.CASH, arr);

        const q: QueueItem = { id: `q-${uid()}`, type: "cash_create", payload: item };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async removeCash(id) {
        const arr = get().cashReceipts.filter(x => x.id !== id);
        set({ cashReceipts: arr }); await setJSON(K.CASH, arr);

        const q: QueueItem = { id: `q-${uid()}`, type: "cash_remove", payload: { id } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async updateCash(id, amount) {
        const arr = get().cashReceipts.map(x => (x.id === id ? { ...x, amount } : x));
        set({ cashReceipts: arr }); await setJSON(K.CASH, arr);

        const q: QueueItem = { id: `q-${uid()}`, type: "cash_update", payload: { id, amount } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async updateSale(id, patch) {
        const arr = get().sales.map(s => (s.id === id ? { ...s, qty: patch.qty, price: patch.price } : s));
        set({ sales: arr }); await setJSON(K.SALES, arr);

        const q: QueueItem = { id: `q-${uid()}`, type: "sale_update", payload: { id, qty: patch.qty, price: patch.price } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async removeSale(id) {
        const arr = get().sales.filter(s => s.id !== id);
        set({ sales: arr }); await setJSON(K.SALES, arr);

        const q: QueueItem = { id: `q-${uid()}`, type: "sale_remove", payload: { id } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async updateReturn(id, patch) {
        const arr = get().returns.map(r => (r.id === id ? { ...r, qty: patch.qty, price: patch.price } : r));
        set({ returns: arr }); await setJSON(K.RETURNS, arr);

        const q: QueueItem = { id: `q-${uid()}`, type: "return_update", payload: { id, qty: patch.qty, price: patch.price } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async removeReturn(id) {
        const arr = get().returns.filter(r => r.id !== id);
        set({ returns: arr }); await setJSON(K.RETURNS, arr);

        const q: QueueItem = { id: `q-${uid()}`, type: "return_remove", payload: { id } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    queueStats() {
        const q = get().queue || [];
        return {
            stores: q.filter(x => x.type === "store_upsert").length,
            products: q.filter(x => x.type === "product_upsert").length,
            sales: q.filter(x => x.type === "sale_create").length,
            returns: q.filter(x => x.type === "return_create").length,
            cash: q.filter(x => x.type.startsWith("cash_")).length,
        };
    },

    async pushNow() {
        if (get()._pushing) return;
        const queue = [...(get().queue || [])];
        if (!queue.length) return;

        set({ _pushing: true });
        try {
            // ✅ backend: POST /api/sync/push  { items: [...] }
            // biz queue itemlarni to‘g‘ridan-to‘g‘ri yuboramiz
            await api.sync.push(queue);

            // agar server qabul qilsa — queue tozalaymiz
            set({ queue: [] });
            await setJSON(K.QUEUE, []);
        } catch {
            // serverga chiqmasa -> queue qoladi
        } finally {
            set({ _pushing: false });
        }
    },

    async pullNow() {
        try {
            const snap = await api.sync.snapshot();
            // snapshot() -> { ok:true, ...data } bo‘lishi kerak
            // Biz eng ko‘p ishlatiladigan field’larni qamrab olamiz.
            // Sizning sync.service snapshot() qaytaradigan nomlar boshqacha bo‘lsa,
            // keyingi xabarda snap logini yuborasiz — 1 daqiqada moslab beraman.
            const stores = (snap.stores ?? snap.data?.stores ?? []) as Store[];
            const products = (snap.products ?? snap.data?.products ?? []) as Product[];
            const sales = (snap.sales ?? snap.data?.sales ?? []) as Sale[];
            const returns = (snap.returns ?? snap.data?.returns ?? []) as Ret[];

            // cash-receipts alohida endpointda
            let cashReceipts: CashReceipt[] = get().cashReceipts;
            const storeId = get().currentStoreId;
            if (storeId) {
                try {
                    const r = await api.cash.list(String(storeId));
                    cashReceipts = (r.data || []).map((x: any) => ({
                        id: x.id,
                        storeId: x.store_id ?? x.storeId,
                        amount: Number(x.amount || 0),
                        created_at: +new Date(x.created_at),
                    })) as any;
                } catch { }
            }

            set({ stores, products, sales, returns, cashReceipts });

            await Promise.all([
                setJSON(K.STORES, stores),
                setJSON(K.PRODUCTS, products),
                setJSON(K.SALES, sales),
                setJSON(K.RETURNS, returns),
                setJSON(K.CASH, cashReceipts),
            ]);

            const lastPull = Date.now();
            set({ lastPull });
            await setJSON(K.META, { lastPull });
        } catch {
            // offline -> hech narsa qilmaymiz
        }
    },

    async startPull() {
        // realtime yo‘q. App ochilganda 1 marta snapshot yetarli.
        await get().pullNow();
    },
}));
