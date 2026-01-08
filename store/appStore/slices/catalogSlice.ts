// store/appStore/slices/catalogSlice.ts
import type { StateCreator } from "zustand";
import { uid } from "../helpers";
import type { AppState } from "../index";
import type { Category, Product, Store } from "../types";

export type CatalogSlice = {
    stores: Store[];
    products: Product[];
    categories: Category[];

    setCatalog: (payload: { stores?: Store[]; products?: Product[]; categories?: Category[] }) => void;

    // ✅ CRUD (local + queue)
    upsertStore: (store: Store) => Promise<void>;
    removeStore: (storeId: string) => Promise<void>;

    upsertProduct: (p: Product) => Promise<void>;
    removeProduct: (productId: string) => Promise<void>;

    upsertCategory: (c: Category) => Promise<void>;
    removeCategory: (categoryId: string) => Promise<void>;
};

export const createCatalogSlice: StateCreator<
    AppState,
    [["zustand/persist", unknown]],
    [],
    CatalogSlice
> = (set, get) => ({
    stores: [],
    products: [],
    categories: [],

    setCatalog: ({ stores, products, categories }) =>
        set((s) => ({
            stores: Array.isArray(stores) ? stores : s.stores,
            products: Array.isArray(products) ? products : s.products,
            categories: Array.isArray(categories) ? categories : (s as any).categories ?? [],
        })),

    // ---------- STORES ----------
    upsertStore: async (store) => {
        const st: Store = {
            id: String(store.id),
            name: String(store.name ?? "").trim(),
            type: store.type,
            prices: store.prices ?? {},
        };

        set((s) => {
            const exists = s.stores.some((x) => String(x.id) === st.id);
            const stores = exists ? s.stores.map((x) => (String(x.id) === st.id ? { ...x, ...st } : x)) : [st, ...s.stores];

            return {
                stores,
                queue: [{ id: uid(), kind: "store:upsert", payload: st, created_at: Date.now() }, ...s.queue],
            };
        });
    },

    removeStore: async (storeId) => {
        const id = String(storeId);
        set((s) => ({
            stores: s.stores.filter((x) => String(x.id) !== id),
            queue: [{ id: uid(), kind: "store:remove", payload: { id }, created_at: Date.now() }, ...s.queue],
        }));
    },

    // ---------- PRODUCTS ----------
    upsertProduct: async (p) => {
        const pr: Product = { ...p, id: String(p.id), name: String(p.name ?? "").trim() };

        set((s) => {
            const exists = s.products.some((x) => String(x.id) === String(pr.id));
            const products = exists ? s.products.map((x) => (String(x.id) === String(pr.id) ? { ...x, ...pr } : x)) : [pr, ...s.products];

            return {
                products,
                queue: [{ id: uid(), kind: "product:upsert", payload: pr, created_at: Date.now() }, ...s.queue],
            };
        });
    },

    removeProduct: async (productId) => {
        const id = String(productId);
        set((s) => ({
            products: s.products.filter((x) => String(x.id) !== id),
            queue: [{ id: uid(), kind: "product:remove", payload: { id }, created_at: Date.now() }, ...s.queue],
        }));
    },

    // ---------- CATEGORIES ----------
    upsertCategory: async (c) => {
        const cat: Category = { id: String(c.id), name: String(c.name ?? "").trim() };

        set((s: any) => {
            const list: Category[] = Array.isArray(s.categories) ? s.categories : [];
            const exists = list.some((x) => String(x.id) === cat.id);
            const categories = exists ? list.map((x) => (String(x.id) === cat.id ? { ...x, ...cat } : x)) : [cat, ...list];

            return {
                categories,
                queue: [{ id: uid(), kind: "category:upsert", payload: cat, created_at: Date.now() }, ...s.queue],
            };
        });
    },

    removeCategory: async (categoryId) => {
        const id = String(categoryId);
        set((s: any) => {
            const list: Category[] = Array.isArray(s.categories) ? s.categories : [];
            return {
                categories: list.filter((x) => String(x.id) !== id),
                queue: [{ id: uid(), kind: "category:remove", payload: { id }, created_at: Date.now() }, ...s.queue],
            };
        });
    },
});
