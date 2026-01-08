// store/appStore/index.ts
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { CashReceiptRow, Category, Product, QueueItem, ReturnRow, SaleRow, Store } from "./types";

import { createBootSlice, type BootSlice } from "./slices/bootSlice";
import { createCatalogSlice, type CatalogSlice } from "./slices/catalogSlice";
import { createSyncSlice, type SyncSlice } from "./slices/syncSlice";
import { createTxSlice, type TxSlice } from "./slices/txSlice";
import { createUiSlice, type UiSlice } from "./slices/uiSlice";

export type AppState =
    & BootSlice
    & UiSlice
    & CatalogSlice
    & TxSlice
    & SyncSlice;

// Persistga faqat data’ni yozamiz (functions emas)
type Persisted = {
    menuOpen: boolean;
    currentStoreId: string | null;

    stores: Store[];
    products: Product[];
    categories: Category[]; // ✅

    sales: SaleRow[];
    returns: ReturnRow[];
    cashReceipts: CashReceiptRow[];

    queue: QueueItem[];
};

export const useAppStore = create<AppState>()(
    persist(
        (...a) => ({
            ...createBootSlice(...a),
            ...createUiSlice(...a),
            ...createCatalogSlice(...a),
            ...createTxSlice(...a),
            ...createSyncSlice(...a),
        }),
        {
            name: "savdohisobi_appstore_v2", // eski key bilan qoldirdim (data yo‘qolmasin)
            version: 2,
            storage: createJSONStorage(() => AsyncStorage),

            partialize: (s): Persisted => ({
                menuOpen: s.menuOpen,
                currentStoreId: s.currentStoreId,

                stores: s.stores,
                products: s.products,
                categories: (s as any).categories ?? [], // ✅

                sales: s.sales,
                returns: s.returns,
                cashReceipts: s.cashReceipts,

                queue: s.queue,
            }),

            onRehydrateStorage: () => (state, err) => {
                // ✅ HYDRATE crash’ni yopamiz: hydrated flag + menu reset
                try {
                    state?.setMenu(false);
                } catch { }

                try {
                    state?.setHydrated(true);
                } catch { }

                // optional: init’ni ham chaqirib qo‘yamiz (await qilmaymiz)
                try {
                    state?.init?.();
                } catch { }

                if (err) {
                    // xohlasangiz log
                    // console.log("rehydrate error", err);
                }
            },
        }
    )
);
