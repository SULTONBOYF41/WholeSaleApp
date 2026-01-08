// store/appStore/types.ts
export type StoreType = "branch" | "market";
export type Unit = "дона" | "кг";

export type Category = {
    id: string;
    name: string;
};

export type Store = {
    id: string;
    name: string;
    type: StoreType;

    // ✅ add-store uchun
    prices?: Record<string, number>;
};

export type Product = {
    id: string;
    name: string;
    unit?: Unit | string;
    priceBranch?: number;
    priceMarket?: number;

    // ixtiyoriy
    categoryId?: string | null;
};

export type SaleRow = {
    id: string;
    storeId: string;
    storeName?: string;
    created_at: number; // unix ms
    batchId?: string;

    productName: string;
    qty: number;
    price: number;
    unit: Unit;
};

export type ReturnRow = SaleRow;

export type CashReceiptRow = {
    id: string;
    storeId: string;
    created_at: number;
    amount: number;
};

// ✅ Queue kengaytirildi (stores/products/categories ham sync bo‘lsin)
export type QueueItem =
    // tx
    | { id: string; kind: "sale:add"; payload: SaleRow; created_at: number }
    | { id: string; kind: "sale:update"; payload: { id: string; patch: Partial<Pick<SaleRow, "qty" | "price">> }; created_at: number }
    | { id: string; kind: "sale:remove"; payload: { id: string }; created_at: number }

    | { id: string; kind: "return:add"; payload: ReturnRow; created_at: number }
    | { id: string; kind: "return:update"; payload: { id: string; patch: Partial<Pick<ReturnRow, "qty" | "price">> }; created_at: number }
    | { id: string; kind: "return:remove"; payload: { id: string }; created_at: number }

    | { id: string; kind: "cash:add"; payload: CashReceiptRow; created_at: number }
    | { id: string; kind: "cash:update"; payload: { id: string; amount: number }; created_at: number }
    | { id: string; kind: "cash:remove"; payload: { id: string }; created_at: number }

    // ✅ catalog
    | { id: string; kind: "store:upsert"; payload: Store; created_at: number }
    | { id: string; kind: "store:remove"; payload: { id: string }; created_at: number }

    | { id: string; kind: "product:upsert"; payload: Product; created_at: number }
    | { id: string; kind: "product:remove"; payload: { id: string }; created_at: number }

    | { id: string; kind: "category:upsert"; payload: Category; created_at: number }
    | { id: string; kind: "category:remove"; payload: { id: string }; created_at: number };
