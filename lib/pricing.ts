// lib/pricing.ts
import type { Product, Store } from "@/types";

/**
 * Do‘kon/Filiialga mos default narxni qaytaradi.
 * Agar store topilmasa yoki product narxlari yo‘q bo‘lsa 0 qaytaradi.
 */
export function getStorePrice(args: { storeId: string; stores: Store[]; product: Product }): number {
    const { storeId, stores, product } = args;

    if (!product) return 0;
    // product’da to‘g‘ridan-to‘g‘ri priceBranch/priceMarket bo‘lmasa ham xatoga ketmasin:
    const pBranch = (product as any).priceBranch ?? 0;
    const pMarket = (product as any).priceMarket ?? 0;

    // store'ni topamiz
    const st = stores.find((s) => String(s.id) === String(storeId));
    if (!st) return 0;

    // store turiga qarab narx
    if (st.type === "branch") return Number(pBranch) || 0;
    if (st.type === "market") return Number(pMarket) || 0;

    // unknown bo‘lsa — 0
    return 0;
}
