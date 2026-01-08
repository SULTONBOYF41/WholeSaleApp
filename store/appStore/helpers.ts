// store/appStore/helpers.ts
import type { CashReceiptRow, Product, ReturnRow, SaleRow, Store } from "./types";

export const uid = () => `${Date.now().toString(36)}-${Math.random().toString(16).slice(2)}`;

export function safeArr<T>(v: any): T[] {
    return Array.isArray(v) ? (v as T[]) : [];
}

export function normalizeSnapshot(raw: any): {
    stores: Store[];
    products: Product[];
    sales: SaleRow[];
    returns: ReturnRow[];
    cashReceipts: CashReceiptRow[];
} {
    // backend turlicha: {data:{...}} yoki bevosita {...}
    const root = raw?.data ?? raw ?? {};
    const data = root?.data ?? root;

    const stores = safeArr<Store>(data?.stores);
    const products = safeArr<Product>(data?.products);

    const sales = safeArr<any>(data?.sales).map((x) => ({
        id: String(x.id ?? uid()),
        storeId: String(x.storeId ?? x.store_id ?? ""),
        storeName: x.storeName ?? x.store_name,
        created_at: Number(x.created_at ?? x.createdAt ?? Date.now()),
        batchId: x.batchId ?? x.batch_id,
        productName: String(x.productName ?? x.product_name ?? ""),
        qty: Number(x.qty ?? 0),
        price: Number(x.price ?? 0),
        unit: (x.unit ?? "дона") as "дона" | "кг",
    })) as SaleRow[];

    const returns = safeArr<any>(data?.returns).map((x) => ({
        id: String(x.id ?? uid()),
        storeId: String(x.storeId ?? x.store_id ?? ""),
        storeName: x.storeName ?? x.store_name,
        created_at: Number(x.created_at ?? x.createdAt ?? Date.now()),
        batchId: x.batchId ?? x.batch_id,
        productName: String(x.productName ?? x.product_name ?? ""),
        qty: Number(x.qty ?? 0),
        price: Number(x.price ?? 0),
        unit: (x.unit ?? "дона") as "дона" | "кг",
    })) as ReturnRow[];

    const cashRaw = data?.cashReceipts ?? data?.cash ?? data?.cash_receipts;
    const cashReceipts = safeArr<any>(cashRaw).map((x) => ({
        id: String(x.id ?? uid()),
        storeId: String(x.storeId ?? x.store_id ?? ""),
        created_at: Number(x.created_at ?? x.createdAt ?? Date.now()),
        amount: Number(x.amount ?? 0),
    })) as CashReceiptRow[];

    return { stores, products, sales, returns, cashReceipts };
}
