export type StoreType = "branch" | "market";
export type Unit = "дона" | "кг";

export type Store = { id: string; type: StoreType; name: string; prices: Record<string, number> };
export type Category = { id: string; name: string };

// ⬇️ KATEGORIYA BOG'LANISHI QO‘SHILDI
export type Product = {
    id: string;
    name: string;
    categoryId?: string;   // <-- YANGI
    priceBranch?: number;
    priceMarket?: number;
};

export type Sale = {
    id: string;
    storeId: string;
    productName: string;
    qty: number;
    unit: Unit;
    price: number;
    created_at: number;
    batchId?: string;
};
export type Ret = {
    id: string;
    storeId: string;
    productName: string;
    qty: number;
    unit: Unit;
    price: number;
    created_at: number;
    batchId?: string;
};

export type CashReceipt = { id: string; storeId: string; amount: number; created_at: number };

export type QueueItem =
    | { id: string; type: "store_upsert"; payload: Store }
    | { id: string; type: "product_upsert"; payload: Product }
    | { id: string; type: "sale_create"; payload: Sale }
    | { id: string; type: "return_create"; payload: Ret }
    | { id: string; type: "store_remove"; payload: { id: string } }
    | { id: string; type: "product_remove"; payload: { id: string } }
    | { id: string; type: "sale_update"; payload: { id: string; qty: number; price: number } }
    | { id: string; type: "sale_remove"; payload: { id: string } }
    | { id: string; type: "return_update"; payload: { id: string; qty: number; price: number } }
    | { id: string; type: "return_remove"; payload: { id: string } };

export type MonthlySummary = {
    ym: string;
    store_id: string;
    total_sales: number;
    total_returns: number;
    total_cash: number;
    delta?: number;
    debt_raw: number;
    debt: number;
    computed_at: string;
};

export type CurrentBalanceRow = {
    store_id: string;
    store_name: string;
    ym: string;
    balance: number;
};
