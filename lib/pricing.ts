// lib/pricing.ts
import type { Product, Store } from "@/types";

/**
 * Joriy store + mahsulot uchun to‘g‘ri narx.
 * Ustuvorlik:
 *   1) store.prices[product.id]                (per-product override)
 *   2) store.prices[product.categoryId]       (per-category override, agar mavjud bo‘lsa)
 *   3) product.prices?.[store.type] yoki product.priceBranch/priceMarket
 *   4) product.basePrice yoki product.price yoki 0
 */
export function getStorePrice(opts: {
    storeId: string;
    stores: Store[];
    product: Product;
}) {
    const { storeId, stores, product } = opts;

    const store = stores.find((s) => s.id === storeId);
    if (!store) {
        // store topilmasa, eng xavfsiz fallback
        const base =
            (product as any).basePrice ??
            (product as any).price ??
            0;
        return Number(base);
    }

    const prices = store.prices || {};

    // 1) PER-PRODUCT override (eng ustuvor)
    if (product.id && Number.isFinite(prices[product.id])) {
        return Number(prices[product.id] as number);
    }

    // 2) PER-CATEGORY override (agar mahsulotda category identifikatori bo‘lsa)
    const catId =
        (product as any).categoryId ??
        (product as any).category_id ??
        (product as any).categoryID;
    if (catId && Number.isFinite(prices[catId])) {
        return Number(prices[catId] as number);
    }

    // 3) Mahsulot ichidagi store-type bo‘yicha fallback
    const byProductType =
        (product as any)?.prices?.[store.type] ??
        (store.type === "branch"
            ? (product as any).priceBranch
            : (product as any).priceMarket);
    if (Number.isFinite(byProductType)) return Number(byProductType);

    // 4) Umumiy fallback
    const base =
        (product as any).basePrice ??
        (product as any).price ??
        0;

    return Number(base);
}
