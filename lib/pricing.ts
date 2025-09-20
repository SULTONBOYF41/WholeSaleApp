// lib/pricing.ts
import type { Product, Store } from "@/types";

/**
 * Joriy store + mahsulot uchun to‘g‘ri narx.
 * 1) store.prices[product.categoryId] bo‘lsa — shu
 * 2) bo‘lmasa, product.prices?.[store.type] yoki product.priceBranch/priceMarket (agar bor bo‘lsa)
 * 3) bo‘lmasa, product.price/basePrice yoki 0
 */
export function getStorePrice(opts: {
    storeId: string;
    stores: Store[];
    product: Product;
}) {
    const { storeId, stores, product } = opts;

    const store = stores.find((s) => s.id === storeId);
    if (!store) return Number((product as any).price ?? 0);

    // Sizda category id nomi qaysi? (categoryId yoki category_id)
    const catId =
        (product as any).categoryId ??
        (product as any).category_id ??
        (product as any).categoryID;

    // 1) Store darajasidagi narx (category asosida)
    const byStoreCategory = (store.prices || {})[catId];
    if (Number.isFinite(byStoreCategory)) return Number(byStoreCategory);

    // 2) Mahsulot ichidagi fallback (agar shunaqa tuzilmangiz bo‘lsa)
    const byProductType =
        (product as any)?.prices?.[store.type] ??
        (store.type === "branch"
            ? (product as any).priceBranch
            : (product as any).priceMarket);
    if (Number.isFinite(byProductType)) return Number(byProductType);

    // 3) Umumiy fallback
    const base =
        (product as any).basePrice ??
        (product as any).price ??
        0;

    return Number(base);
}
