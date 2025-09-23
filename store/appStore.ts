// store/appStore.ts
import { getJSON, K, setJSON } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import type { CashReceipt, Category, Product, Ret, Sale, Store } from "@/types";
import { create } from "zustand";


const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

type AppState = {
    stores: Store[];
    categories: Category[];
    products: Product[];
    sales: Sale[];
    returns: Ret[];
    cashReceipts: CashReceipt[];
    queue: any[]; // kengaytirilgan navbat (sale/return/product/store/cash hammasi)
    currentStoreId?: string;

    menuOpen: boolean;
    realtimeOn: boolean;
    lastPull?: number;

    _pushTimer?: any;
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

    // Kassa (offline-first)
    addCash: (storeId: string, amount: number) => Promise<void>;
    removeCash: (id: string) => Promise<void>;
    updateCash: (id: string, amount: number) => Promise<void>;

    // Tarix CRUD (offline-first)
    updateSale: (id: string, patch: { qty: number; price: number }) => Promise<void>;
    removeSale: (id: string) => Promise<void>;
    updateReturn: (id: string, patch: { qty: number; price: number }) => Promise<void>;
    removeReturn: (id: string) => Promise<void>;

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
            getJSON<any[]>(K.QUEUE, []),
            getJSON<{ lastPull?: number }>(K.META, {}),
            getJSON<CashReceipt[]>(K.CASH, []),
        ]);
        set({ stores, categories: cats, products, sales, returns, queue, lastPull: meta.lastPull, cashReceipts: cash });
        await get().startPull();
        if (queue.length) get().schedulePush();
    },

    setMenu(v) { set({ menuOpen: v }); },
    setCurrentStore(id) { set({ currentStoreId: id, menuOpen: false }); },

    schedulePush() {
        const t = get()._pushTimer;
        if (t) clearTimeout(t as any);
        const timer = setTimeout(() => get().pushNow(), 1200);
        set({ _pushTimer: timer });
    },

    async upsertStore(s) {
        const id = s.id ?? `st-${uid()}`;
        const next: Store = { id, type: s.type, name: s.name, prices: s.prices ?? {} };
        const arr = [...get().stores.filter(x => x.id !== id), next];
        set({ stores: arr }); await setJSON(K.STORES, arr);

        const q = { id: `q-${uid()}`, type: "store_upsert", payload: next };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async removeStore(id) {
        const arr = get().stores.filter(s => s.id !== id);
        set({ stores: arr }); await setJSON(K.STORES, arr);

        const q = { id: `q-${uid()}`, type: "store_remove", payload: { id } };
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
            id, name: p.name,
            categoryId: (p as any).categoryId ?? (p as any).category_id ?? undefined,
            priceBranch: p.priceBranch, priceMarket: p.priceMarket,
        };
        const arr = [...get().products.filter(x => x.id !== id), next];
        set({ products: arr }); await setJSON(K.PRODUCTS, arr);

        const q = { id: `q-${uid()}`, type: "product_upsert", payload: next };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async removeProduct(id) {
        const arr = get().products.filter(p => p.id !== id);
        set({ products: arr }); await setJSON(K.PRODUCTS, arr);

        const q = { id: `q-${uid()}`, type: "product_remove", payload: { id } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async addSale(s) {
        const item: Sale = { id: `sa-${uid()}`, created_at: Date.now(), ...s };
        const arr = [...get().sales, item];
        set({ sales: arr }); await setJSON(K.SALES, arr);
        const q = { id: `q-${uid()}`, type: "sale_create", payload: item };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    async addReturn(r) {
        const item: Ret = { id: `rt-${uid()}`, created_at: Date.now(), ...r };
        const arr = [...get().returns, item];
        set({ returns: arr }); await setJSON(K.RETURNS, arr);
        const q = { id: `q-${uid()}`, type: "return_create", payload: item };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    // ===== CASH (offline-first) =====
    async addCash(storeId, amount) {
        const item: CashReceipt = { id: `cr-${uid()}`, storeId, amount, created_at: Date.now() };
        const arr = [...get().cashReceipts, item];
        set({ cashReceipts: arr }); await setJSON(K.CASH, arr);

        const q = { id: `q-${uid()}`, type: "cash_create", payload: item };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },
    async removeCash(id) {
        const arr = get().cashReceipts.filter(x => x.id !== id);
        set({ cashReceipts: arr }); await setJSON(K.CASH, arr);

        const q = { id: `q-${uid()}`, type: "cash_remove", payload: { id } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },
    async updateCash(id, amount) {
        const arr = get().cashReceipts.map(x => (x.id === id ? { ...x, amount } : x));
        set({ cashReceipts: arr }); await setJSON(K.CASH, arr);

        const q = { id: `q-${uid()}`, type: "cash_update", payload: { id, amount } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    // === Tarix CRUD ===
    async updateSale(id, patch) {
        const arr = get().sales.map(s => (s.id === id ? { ...s, qty: patch.qty, price: patch.price } : s));
        set({ sales: arr }); await setJSON(K.SALES, arr);

        const q = { id: `q-${uid()}`, type: "sale_update", payload: { id, qty: patch.qty, price: patch.price } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },
    async removeSale(id) {
        const arr = get().sales.filter(s => s.id !== id);
        set({ sales: arr }); await setJSON(K.SALES, arr);

        const q = { id: `q-${uid()}`, type: "sale_remove", payload: { id } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },
    async updateReturn(id, patch) {
        const arr = get().returns.map(r => (r.id === id ? { ...r, qty: patch.qty, price: patch.price } : r));
        set({ returns: arr }); await setJSON(K.RETURNS, arr);

        const q = { id: `q-${uid()}`, type: "return_update", payload: { id, qty: patch.qty, price: patch.price } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },
    async removeReturn(id) {
        const arr = get().returns.filter(r => r.id !== id);
        set({ returns: arr }); await setJSON(K.RETURNS, arr);

        const q = { id: `q-${uid()}`, type: "return_remove", payload: { id } };
        const qq = [...get().queue, q]; set({ queue: qq }); await setJSON(K.QUEUE, qq);
        get().schedulePush();
    },

    queueStats() {
        const q = get().queue;
        return {
            stores: q.filter((x: any) => x.type === "store_upsert").length,
            products: q.filter((x: any) => x.type === "product_upsert").length,
            sales: q.filter((x: any) => x.type === "sale_create").length,
            returns: q.filter((x: any) => x.type === "return_create").length,
        };
    },

    // store/appStore.ts ichida: mavjud pushNow ni shu kod bilan ALMASHTIRING

    async pushNow() {
        if (get()._pushing) return;
        set({ _pushing: true });

        // xohlasangiz vaqtinchalik ichki debuggers uchun true qiling
        const DEBUG = false;
        const log = (...args: any[]) => { if (DEBUG) console.log("[pushNow]", ...args); };

        // --- FK xatolarini oldini olish uchun: store mavjudligini kafolatlash
        const ensureStore = async (storeId: string) => {
            if (!storeId) throw new Error("store_id missing");

            // 1) Lokal bor-mi?
            const hasLocal = (get().stores ?? []).some((s) => String(s.id) === String(storeId));
            if (hasLocal) return true;

            // 2) Serverda bor-mi?
            const { data: exists, error: e1 } = await supabase
                .from("stores")
                .select("id")
                .eq("id", storeId)
                .limit(1);

            if (!e1 && exists && exists.length) return true;

            // 3) Yo‘q bo‘lsa — minimal placeholder yaratamiz (branch sifatida)
            const placeholder: Store = {
                id: storeId,
                name: `Recovered-${String(storeId).slice(0, 6)}`,
                type: "branch",
                prices: {} as Record<string, number>,
            };

            const { error: insErr } = await supabase.from("stores").insert(placeholder);
            if (insErr) throw insErr;

            // Lokalga ham qo‘shib qo‘yamiz (UI/merge uchun)
            const merged: Store[] = [
                ...(get().stores ?? []).filter((x) => x.id !== storeId),
                placeholder,
            ];
            set({ stores: merged });
            await setJSON(K.STORES, merged);

            log("Store placeholder created:", placeholder.id);
            return true;
        };

        // === Navbatni ko‘chirib olamiz va ishlaymiz
        const q = [...(get().queue as any[] ?? [])];
        const rest: any[] = [];

        log("start; queue len =", q.length);

        for (const it of q) {
            try {
                // ---------------- STORES ----------------
                if (it.type === "store_upsert") {
                    const p = it.payload as Store;
                    const { error } = await supabase.from("stores").upsert({
                        id: p.id,
                        name: p.name,
                        type: p.type,
                        prices: p.prices ?? {},
                    });
                    if (error) throw error;
                } else if (it.type === "store_remove") {
                    const { id } = it.payload as { id: string };
                    const { error } = await supabase.from("stores").delete().eq("id", id);
                    if (error) throw error;

                    // ---------------- PRODUCTS ----------------
                } else if (it.type === "product_upsert") {
                    const p = it.payload as Product;
                    const { error } = await supabase.from("products").upsert({
                        id: p.id,
                        name: p.name,
                        category_id: p.categoryId ?? null,
                        price_branch: p.priceBranch ?? null,
                        price_market: p.priceMarket ?? null,
                    });
                    if (error) throw error;
                } else if (it.type === "product_remove") {
                    const { id } = it.payload as { id: string };
                    const { error } = await supabase.from("products").delete().eq("id", id);
                    if (error) throw error;

                    // ---------------- SALES ----------------
                } else if (it.type === "sale_create") {
                    const s = it.payload as Sale;
                    await ensureStore(s.storeId);
                    const { error } = await supabase.from("sales").insert({
                        id: s.id,
                        store_id: s.storeId,
                        product_name: s.productName,
                        qty: s.qty,
                        unit: s.unit,
                        price: s.price,
                        batch_id: s.batchId ?? null,
                        created_at: new Date(s.created_at).toISOString(),
                    });
                    if (error) throw error;
                } else if (it.type === "sale_update") {
                    const { id, qty, price } = it.payload as { id: string; qty: number; price: number };
                    const { error } = await supabase.from("sales").update({ qty, price }).eq("id", id);
                    if (error) throw error;
                } else if (it.type === "sale_remove") {
                    const { id } = it.payload as { id: string };
                    const { error } = await supabase.from("sales").delete().eq("id", id);
                    if (error) throw error;

                    // ---------------- RETURNS ----------------
                } else if (it.type === "return_create") {
                    const r = it.payload as Ret;
                    await ensureStore(r.storeId);
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
                } else if (it.type === "return_update") {
                    const { id, qty, price } = it.payload as { id: string; qty: number; price: number };
                    const { error } = await supabase.from("returns").update({ qty, price }).eq("id", id);
                    if (error) throw error;
                } else if (it.type === "return_remove") {
                    const { id } = it.payload as { id: string };
                    const { error } = await supabase.from("returns").delete().eq("id", id);
                    if (error) throw error;

                    // ---------------- CASH ----------------
                } else if (it.type === "cash_create") {
                    const c = it.payload as CashReceipt;
                    await ensureStore(c.storeId);
                    const { error } = await supabase.from("cash_receipts").insert({
                        id: c.id,
                        store_id: c.storeId,
                        amount: c.amount,
                        created_at: new Date(c.created_at).toISOString(),
                    });
                    if (error) throw error;
                } else if (it.type === "cash_update") {
                    const { id, amount } = it.payload as { id: string; amount: number };
                    const { error } = await supabase.from("cash_receipts").update({ amount }).eq("id", id);
                    if (error) throw error;
                } else if (it.type === "cash_remove") {
                    const { id } = it.payload as { id: string };
                    const { error } = await supabase.from("cash_receipts").delete().eq("id", id);
                    if (error) throw error;

                    // ---------------- UNKNOWN ----------------
                } else {
                    // not recognized -> qoldiramiz
                    rest.push(it);
                }
            } catch (_e) {
                // xato bo‘lsa keyinroq urinib ko‘ramiz
                rest.push(it);
            }
        }

        set({ queue: rest, _pushing: false });
        await setJSON(K.QUEUE, rest);

        log("done; rest len =", rest.length);

        if (rest.length) get().schedulePush();
    },





    async pullNow() {
        const [st, pr, sa, re, cr] = await Promise.all([
            supabase.from("stores").select("*"),
            supabase.from("products").select("*"),
            supabase.from("sales").select("*").order("created_at", { ascending: true }),
            supabase.from("returns").select("*").order("created_at", { ascending: true }),
            supabase.from("cash_receipts").select("*").order("created_at", { ascending: true }),
        ]);

        // === STORES ===
        // STORES (server truth; faqat pending upsertlar bilan boyitamiz)
        if (st.data) {
            // 1) Serverdan
            const fromServer: Store[] = st.data.map((x: any) => ({
                id: x.id,
                name: x.name,
                type: x.type,
                prices: x.prices || {},
            }));

            // 2) Queue'dagi store_upsert / store_remove holatini inobatga olamiz
            const queueAll = get().queue ?? [];
            const upserts = queueAll.filter((q: any) => q.type === "store_upsert");
            const removes = queueAll.filter((q: any) => q.type === "store_remove");

            const pendingUpsert = new Map<string, Store>();
            for (const q of upserts) {
                const s = q.payload as Store;
                pendingUpsert.set(s.id, {
                    id: s.id,
                    name: s.name,
                    type: s.type,
                    prices: s.prices ?? {},
                });
            }
            const pendingRemoveIds = new Set<string>(removes.map((q: any) => q.payload.id));

            // 3) Birlashtirish:
            //    - Avval serverdan kelganlarni qo'yamiz
            //    - So‘ng pending upsertlar bilan override qilamiz
            //    - Pending remove id’larini o‘chirib tashlaymiz
            const byId = new Map<string, Store>();
            for (const s of fromServer) byId.set(s.id, s);
            for (const s of pendingUpsert.values()) byId.set(s.id, s);
            for (const rid of pendingRemoveIds) byId.delete(rid);

            // 4) E’tibor bering: LOCAL ONLY (serverda yo‘q, queue’da ham yo‘q) itemlar QO‘SHILMAYDI.
            //    Demak, serverdan o‘chirilgan store localda ham yo‘qoladi.

            const merged = Array.from(byId.values());
            set({ stores: merged });
            await setJSON(K.STORES, merged);
        }

        // === PRODUCTS ===
        // PRODUCTS (server truth; only pending upserts/removes considered)
        if (pr.data) {
            const fromServer: Product[] = pr.data.map((x: any) => ({
                id: x.id,
                name: x.name,
                categoryId: x.category_id ?? x.categoryId ?? undefined,
                priceBranch: x.price_branch ?? undefined,
                priceMarket: x.price_market ?? undefined,
            }));

            const queue = get().queue ?? [];
            const upserts = queue.filter((q: any) => q.type === "product_upsert");
            const removes = queue.filter((q: any) => q.type === "product_remove");

            const pendingUpsert = new Map<string, Product>();
            for (const q of upserts) {
                const p = q.payload as Product;
                pendingUpsert.set(p.id, {
                    id: p.id,
                    name: p.name,
                    categoryId: p.categoryId ?? undefined,
                    priceBranch: p.priceBranch,
                    priceMarket: p.priceMarket,
                });
            }
            const pendingRemoveIds = new Set<string>(removes.map((q: any) => q.payload.id));

            // Server -> pending upserts bilan override -> pending removes ni chiqarib tashla
            const byId = new Map<string, Product>();
            for (const p of fromServer) byId.set(p.id, p);
            for (const p of pendingUpsert.values()) byId.set(p.id, p);
            for (const rid of pendingRemoveIds) byId.delete(rid);

            const merged = Array.from(byId.values());
            set({ products: merged });
            await setJSON(K.PRODUCTS, merged);
        }

        // === SALES ===
        if (sa.data) {
            const fromServer = sa.data.map((x: any) => ({
                id: x.id,
                storeId: x.store_id,
                productName: x.product_name,
                qty: x.qty,
                unit: x.unit,
                price: x.price,
                created_at: new Date(x.created_at).getTime(),
                batchId: x.batch_id ?? undefined,
            }));
            const local = get().sales ?? [];
            const pending = (get().queue ?? []).filter((q: any) => q.type === "sale_create");
            const pendMap = new Map<string, any>();
            for (const q of pending) pendMap.set(q.payload.id, q.payload);

            const localOnly = local.filter((ls) => !fromServer.some((ss) => ss.id === ls.id));
            const byId = new Map<string, any>();
            for (const s of fromServer) byId.set(s.id, s);
            for (const s of pendMap.values()) byId.set(s.id, s);
            for (const s of localOnly) if (!byId.has(s.id)) byId.set(s.id, s);

            const merged = Array.from(byId.values()).sort((a, b) => a.created_at - b.created_at);
            set({ sales: merged });
            await setJSON(K.SALES, merged);
        }

        // === RETURNS ===
        if (re.data) {
            const fromServer = re.data.map((x: any) => ({
                id: x.id,
                storeId: x.store_id,
                productName: x.product_name,
                qty: x.qty,
                unit: x.unit,
                price: x.price,
                created_at: new Date(x.created_at).getTime(),
            }));
            const local = get().returns ?? [];
            const pending = (get().queue ?? []).filter((q: any) => q.type === "return_create");
            const pendMap = new Map<string, any>();
            for (const q of pending) pendMap.set(q.payload.id, q.payload);

            const localOnly = local.filter((lr) => !fromServer.some((rr) => rr.id === lr.id));
            const byId = new Map<string, any>();
            for (const r of fromServer) byId.set(r.id, r);
            for (const r of pendMap.values()) byId.set(r.id, r);
            for (const r of localOnly) if (!byId.has(r.id)) byId.set(r.id, r);

            const merged = Array.from(byId.values()).sort((a, b) => a.created_at - b.created_at);
            set({ returns: merged });
            await setJSON(K.RETURNS, merged);
        }

        // === CASH ===
        if (cr.data) {
            const fromServer = cr.data.map((x: any) => ({
                id: x.id,
                storeId: x.store_id,
                amount: x.amount,
                created_at: new Date(x.created_at).getTime(),
            }));
            const local = get().cashReceipts ?? [];
            const queue = get().queue ?? [];
            const upserts = queue.filter((q: any) => q.type === "cash_create" || q.type === "cash_update");
            const removes = queue.filter((q: any) => q.type === "cash_remove");
            const pendingUpsert = new Map<string, any>();
            for (const q of upserts) {
                const id = q.payload?.id as string;
                const localRow = local.find((r) => r.id === id);
                if (localRow) pendingUpsert.set(id, localRow);
                else if (q.type === "cash_create") pendingUpsert.set(id, q.payload);
            }
            const pendingRemoveIds = new Set(removes.map((q: any) => q.payload.id));
            const localOnly = local.filter(
                (lr) => !fromServer.some((sr) => sr.id === lr.id) && !pendingRemoveIds.has(lr.id)
            );

            const byId = new Map<string, any>();
            for (const c of fromServer) byId.set(c.id, c);
            for (const c of pendingUpsert.values()) byId.set(c.id, c);
            for (const c of localOnly) if (!byId.has(c.id)) byId.set(c.id, c);
            for (const rid of pendingRemoveIds) byId.delete(rid);

            const merged = Array.from(byId.values());
            set({ cashReceipts: merged });
            await setJSON(K.CASH, merged);
        }

        const lastPull = Date.now();
        set({ lastPull });
        await setJSON(K.META, { lastPull });
    },


    async startPull() {
        if (get().realtimeOn) return;
        set({ realtimeOn: true });

        supabase.channel("ch-stores")
            .on("postgres_changes", { event: "*", schema: "public", table: "stores" }, () => get().pullNow())
            .subscribe();
        supabase.channel("ch-products")
            .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () => get().pullNow())
            .subscribe();
        supabase.channel("ch-sales")
            .on("postgres_changes", { event: "*", schema: "public", table: "sales" }, () => get().pullNow())
            .subscribe();
        supabase.channel("ch-returns")
            .on("postgres_changes", { event: "*", schema: "public", table: "returns" }, () => get().pullNow())
            .subscribe();
        supabase.channel("ch-cash")
            .on("postgres_changes", { event: "*", schema: "public", table: "cash_receipts" }, () => get().pullNow())
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
