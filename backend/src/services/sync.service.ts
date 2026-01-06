import { prisma } from "../db";

type QueueItem =
    | { id: string; type: "store_upsert"; payload: any }
    | { id: string; type: "store_remove"; payload: { id: string } }
    | { id: string; type: "product_upsert"; payload: any }
    | { id: string; type: "product_remove"; payload: { id: string } }
    | { id: string; type: "sale_create"; payload: any }
    | { id: string; type: "sale_update"; payload: { id: string; qty: number; price: number } }
    | { id: string; type: "sale_remove"; payload: { id: string } }
    | { id: string; type: "return_create"; payload: any }
    | { id: string; type: "return_update"; payload: { id: string; qty: number; price: number } }
    | { id: string; type: "return_remove"; payload: { id: string } }
    | { id: string; type: "cash_create"; payload: any }
    | { id: string; type: "cash_update"; payload: { id: string; amount: number } }
    | { id: string; type: "cash_remove"; payload: { id: string } };

export async function applyQueue(items: QueueItem[]) {
    const appliedIds: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const it of items) {
        try {
            switch (it.type) {
                case "store_upsert": {
                    const p = it.payload;
                    await prisma.store.upsert({
                        where: { id: String(p.id) },
                        create: { id: String(p.id), name: String(p.name), type: p.type, prices: p.prices ?? {} },
                        update: { name: String(p.name), type: p.type, prices: p.prices ?? {} },
                    });
                    break;
                }
                case "store_remove": {
                    await prisma.store.delete({ where: { id: String(it.payload.id) } });
                    break;
                }
                case "product_upsert": {
                    const p = it.payload;
                    await prisma.product.upsert({
                        where: { id: String(p.id) },
                        create: {
                            id: String(p.id),
                            name: String(p.name),
                            categoryId: p.categoryId ?? null,
                            priceBranch: p.priceBranch ?? null,
                            priceMarket: p.priceMarket ?? null,
                        },
                        update: {
                            name: String(p.name),
                            categoryId: p.categoryId ?? null,
                            priceBranch: p.priceBranch ?? null,
                            priceMarket: p.priceMarket ?? null,
                        },
                    });
                    break;
                }
                case "product_remove": {
                    await prisma.product.delete({ where: { id: String(it.payload.id) } });
                    break;
                }
                case "sale_create": {
                    const s = it.payload;
                    // store must exist:
                    await prisma.store.upsert({
                        where: { id: String(s.storeId) },
                        create: { id: String(s.storeId), name: s.storeName ?? `Recovered-${String(s.storeId).slice(0, 6)}`, type: "branch", prices: {} },
                        update: {},
                    });

                    await prisma.sale.create({
                        data: {
                            id: String(s.id),
                            storeId: String(s.storeId),
                            storeName: s.storeName ?? null,
                            productName: String(s.productName),
                            qty: s.qty,
                            unit: String(s.unit),
                            price: s.price,
                            batchId: s.batchId ?? null,
                            createdAt: new Date(Number(s.created_at)),
                        },
                    });
                    break;
                }
                case "sale_update": {
                    await prisma.sale.update({
                        where: { id: String(it.payload.id) },
                        data: { qty: it.payload.qty, price: it.payload.price },
                    });
                    break;
                }
                case "sale_remove": {
                    await prisma.sale.delete({ where: { id: String(it.payload.id) } });
                    break;
                }
                case "return_create": {
                    const r = it.payload;

                    await prisma.store.upsert({
                        where: { id: String(r.storeId) },
                        create: { id: String(r.storeId), name: r.storeName ?? `Recovered-${String(r.storeId).slice(0, 6)}`, type: "branch", prices: {} },
                        update: {},
                    });

                    await prisma.return.create({
                        data: {
                            id: String(r.id),
                            storeId: String(r.storeId),
                            storeName: r.storeName ?? null,
                            productName: String(r.productName),
                            qty: r.qty,
                            unit: String(r.unit),
                            price: r.price,
                            batchId: r.batchId ?? null,
                            createdAt: new Date(Number(r.created_at)),
                        },
                    });
                    break;
                }
                case "return_update": {
                    await prisma.return.update({
                        where: { id: String(it.payload.id) },
                        data: { qty: it.payload.qty, price: it.payload.price },
                    });
                    break;
                }
                case "return_remove": {
                    await prisma.return.delete({ where: { id: String(it.payload.id) } });
                    break;
                }
                case "cash_create": {
                    const c = it.payload;
                    await prisma.store.upsert({
                        where: { id: String(c.storeId) },
                        create: { id: String(c.storeId), name: `Recovered-${String(c.storeId).slice(0, 6)}`, type: "branch", prices: {} },
                        update: {},
                    });
                    await prisma.cashReceipt.create({
                        data: {
                            id: String(c.id),
                            storeId: String(c.storeId),
                            amount: c.amount,
                            createdAt: new Date(Number(c.created_at)),
                            note: null,
                        },
                    });
                    break;
                }
                case "cash_update": {
                    await prisma.cashReceipt.update({
                        where: { id: String(it.payload.id) },
                        data: { amount: it.payload.amount },
                    });
                    break;
                }
                case "cash_remove": {
                    await prisma.cashReceipt.delete({ where: { id: String(it.payload.id) } });
                    break;
                }
                default:
                    throw new Error("Unknown queue item");
            }

            appliedIds.push(it.id);
        } catch (e: any) {
            failed.push({ id: it.id, error: e?.message ?? "failed" });
        }
    }

    return { appliedIds, failed, serverTime: Date.now() };
}

export async function snapshot() {
    const [stores, products, sales, returns, cashReceipts] = await Promise.all([
        prisma.store.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.product.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.sale.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.return.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.cashReceipt.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

    return {
        stores,
        products,
        sales,
        returns,
        cash_receipts: cashReceipts,
        serverTime: Date.now(),
    };
}
