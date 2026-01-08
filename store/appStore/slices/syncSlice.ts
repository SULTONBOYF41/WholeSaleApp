// store/appStore/slices/syncSlice.ts
import { api } from "@/lib/api";
import type { StateCreator } from "zustand";
import { normalizeSnapshot } from "../helpers";
import type { AppState } from "../index";
import type { Category, Product, QueueItem, Store } from "../types";

function byIdUpsert<T extends { id: string }>(arr: T[], item: T) {
    const id = String(item.id);
    const exists = arr.some((x) => String(x.id) === id);
    return exists ? arr.map((x) => (String(x.id) === id ? { ...x, ...item } : x)) : [item, ...arr];
}
function byIdRemove<T extends { id: string }>(arr: T[], id: string) {
    const xid = String(id);
    return arr.filter((x) => String(x.id) !== xid);
}

function applyQueueToSnapshot(base: any, queue: QueueItem[]) {
    let stores: Store[] = Array.isArray(base.stores) ? base.stores : [];
    let products: Product[] = Array.isArray(base.products) ? base.products : [];
    let categories: Category[] = Array.isArray(base.categories) ? base.categories : [];

    // queue sizda newest-first bo‘lishi mumkin, biz oldest->newest apply qilamiz
    const ordered = [...(queue ?? [])].reverse();

    for (const it of ordered) {
        switch (it.kind) {
            case "store:upsert":
                stores = byIdUpsert(stores, it.payload as any);
                break;
            case "store:remove":
                stores = byIdRemove(stores, (it.payload as any).id);
                break;

            case "product:upsert":
                products = byIdUpsert(products, it.payload as any);
                break;
            case "product:remove":
                products = byIdRemove(products, (it.payload as any).id);
                break;

            case "category:upsert":
                categories = byIdUpsert(categories, it.payload as any);
                break;
            case "category:remove":
                categories = byIdRemove(categories, (it.payload as any).id);
                break;

            default:
                // tx queue (sale/return/cash) snapshotga apply qilmaymiz
                break;
        }
    }

    return { ...base, stores, products, categories };
}

export type SyncSlice = {
    queue: QueueItem[];

    pushNow: () => Promise<void>;
    pullNow: () => Promise<void>;
};

export const createSyncSlice: StateCreator<
    AppState,
    [["zustand/persist", unknown]],
    [],
    SyncSlice
> = (set, get) => ({
    queue: [],

    pushNow: async () => {
        const { queue } = get();
        if (!queue.length) return;

        // ✅ API fail bo‘lsa queue qoladi
        await api.sync.push(queue);
        set({ queue: [] });
    },

    pullNow: async () => {
        const raw = await api.sync.snapshot();

        // normalizeSnapshot eski format bo‘lishi mumkin — shuning uchun any + default []
        const base = normalizeSnapshot(raw) as any;
        const normalized = {
            ...base,
            stores: Array.isArray(base.stores) ? base.stores : [],
            products: Array.isArray(base.products) ? base.products : [],
            categories: Array.isArray(base.categories) ? base.categories : [],
            sales: Array.isArray(base.sales) ? base.sales : [],
            returns: Array.isArray(base.returns) ? base.returns : [],
            cashReceipts: Array.isArray(base.cashReceipts) ? base.cashReceipts : [],
        };

        // ✅ pending queue o‘zgarishlarini snapshotga qayta apply qilamiz
        const snap = applyQueueToSnapshot(normalized, get().queue);

        set((s: any) => ({
            stores: snap.stores.length ? snap.stores : s.stores,
            products: snap.products.length ? snap.products : s.products,
            categories: snap.categories.length ? snap.categories : (s.categories ?? []),

            sales: snap.sales.length ? snap.sales : s.sales,
            returns: snap.returns.length ? snap.returns : s.returns,
            cashReceipts: snap.cashReceipts.length ? snap.cashReceipts : s.cashReceipts,
        }));
    },
});
