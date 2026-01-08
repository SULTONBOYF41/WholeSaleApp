// store/appStore/slices/txSlice.ts
import type { StateCreator } from "zustand";
import { uid } from "../helpers";
import type { AppState } from "../index";
import type { CashReceiptRow, ReturnRow, SaleRow, Unit } from "../types";

export type TxSlice = {
    sales: SaleRow[];
    returns: ReturnRow[];
    cashReceipts: CashReceiptRow[];

    addSale: (input: { storeId: string; productName: string; qty: number; price: number; unit: Unit; batchId?: string }) => Promise<void>;
    updateSale: (id: string, patch: Partial<Pick<SaleRow, "qty" | "price">>) => Promise<void>;
    removeSale: (id: string) => Promise<void>;

    addReturn: (input: { storeId: string; productName: string; qty: number; price: number; unit: Unit; batchId?: string }) => Promise<void>;
    updateReturn: (id: string, patch: Partial<Pick<ReturnRow, "qty" | "price">>) => Promise<void>;
    removeReturn: (id: string) => Promise<void>;

    addCash: (storeId: string, amount: number) => Promise<void>;
    updateCash: (id: string, amount: number) => Promise<void>;
    removeCash: (id: string) => Promise<void>;
};

export const createTxSlice: StateCreator<
    AppState,
    [["zustand/persist", unknown]],
    [],
    TxSlice
> = (set, get) => ({
    sales: [],
    returns: [],
    cashReceipts: [],

    addSale: async (input) => {
        const { stores } = get();
        const stName = stores.find((s) => String(s.id) === String(input.storeId))?.name;

        const row: SaleRow = {
            id: uid(),
            storeId: String(input.storeId),
            storeName: stName,
            created_at: Date.now(),
            batchId: input.batchId,
            productName: input.productName,
            qty: Number(input.qty || 0),
            price: Number(input.price || 0),
            unit: (input.unit || "дона") as any,
        };

        set((s) => ({
            sales: [row, ...s.sales],
            queue: [{ id: uid(), kind: "sale:add", payload: row, created_at: Date.now() }, ...s.queue],
        }));
    },

    updateSale: async (id, patch) => {
        set((s) => ({
            sales: s.sales.map((x) => (x.id === id ? { ...x, ...patch } : x)),
            queue: [{ id: uid(), kind: "sale:update", payload: { id, patch }, created_at: Date.now() }, ...s.queue],
        }));
    },

    removeSale: async (id) => {
        set((s) => ({
            sales: s.sales.filter((x) => x.id !== id),
            queue: [{ id: uid(), kind: "sale:remove", payload: { id }, created_at: Date.now() }, ...s.queue],
        }));
    },

    addReturn: async (input) => {
        const { stores } = get();
        const stName = stores.find((s) => String(s.id) === String(input.storeId))?.name;

        const row: ReturnRow = {
            id: uid(),
            storeId: String(input.storeId),
            storeName: stName,
            created_at: Date.now(),
            batchId: input.batchId,
            productName: input.productName,
            qty: Number(input.qty || 0),
            price: Number(input.price || 0),
            unit: (input.unit || "дона") as any,
        };

        set((s) => ({
            returns: [row, ...s.returns],
            queue: [{ id: uid(), kind: "return:add", payload: row, created_at: Date.now() }, ...s.queue],
        }));
    },

    updateReturn: async (id, patch) => {
        set((s) => ({
            returns: s.returns.map((x) => (x.id === id ? { ...x, ...patch } : x)),
            queue: [{ id: uid(), kind: "return:update", payload: { id, patch }, created_at: Date.now() }, ...s.queue],
        }));
    },

    removeReturn: async (id) => {
        set((s) => ({
            returns: s.returns.filter((x) => x.id !== id),
            queue: [{ id: uid(), kind: "return:remove", payload: { id }, created_at: Date.now() }, ...s.queue],
        }));
    },

    addCash: async (storeId, amount) => {
        const row: CashReceiptRow = {
            id: uid(),
            storeId: String(storeId),
            created_at: Date.now(),
            amount: Number(amount || 0),
        };

        set((s) => ({
            cashReceipts: [row, ...s.cashReceipts],
            queue: [{ id: uid(), kind: "cash:add", payload: row, created_at: Date.now() }, ...s.queue],
        }));
    },

    updateCash: async (id, amount) => {
        set((s) => ({
            cashReceipts: s.cashReceipts.map((x) => (x.id === id ? { ...x, amount: Number(amount || 0) } : x)),
            queue: [{ id: uid(), kind: "cash:update", payload: { id, amount: Number(amount || 0) }, created_at: Date.now() }, ...s.queue],
        }));
    },

    removeCash: async (id) => {
        set((s) => ({
            cashReceipts: s.cashReceipts.filter((x) => x.id !== id),
            queue: [{ id: uid(), kind: "cash:remove", payload: { id }, created_at: Date.now() }, ...s.queue],
        }));
    },
});
