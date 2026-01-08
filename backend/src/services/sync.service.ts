import { prisma } from "../db";

type QueueItem = {
    id: string;
    // eski backend: type: "sale_create"
    type?: string;
    // yangi app: kind: "sale:add"
    kind?: string;
    payload: any;
    created_at?: number;
    createdAt?: number;
};

function kindOf(it: QueueItem) {
    return String(it.kind ?? it.type ?? "");
}

export async function applyQueue(items: QueueItem[]) {
    const appliedIds: string[] = [];
    const failed: { id: string; error: string }[] = [];

    for (const it of items) {
        try {
            const k = kindOf(it);

            switch (k) {
                // ---------- STORES ----------
                case "store_upsert":
                case "store:upsert": {
                    const p = it.payload;

                    // ✅ SQLite uchun prices STRING bo'lishi kerak.
                    // App object yuborsa -> JSON stringga aylantiramiz
                    const pricesStr =
                        typeof p.prices === "string"
                            ? p.prices
                            : JSON.stringify(p.prices ?? {});

                    await prisma.store.upsert({
                        where: { id: String(p.id) },
                        create: {
                            id: String(p.id),
                            name: String(p.name),
                            type: String(p.type),
                            prices: pricesStr,
                        },
                        update: {
                            name: String(p.name),
                            type: String(p.type),
                            prices: pricesStr,
                        },
                    });

                    break;
                }

                case "store_remove":
                case "store:remove": {
                    await prisma.store.delete({ where: { id: String(it.payload.id) } });
                    break;
                }

                // ---------- PRODUCTS ----------
                case "product_upsert":
                case "product:upsert": {
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
                case "product_remove":
                case "product:remove": {
                    await prisma.product.delete({ where: { id: String(it.payload.id) } });
                    break;
                }

                // ---------- CATEGORIES (agar prisma'da bo'lsa) ----------
                case "category_upsert":
                case "category:upsert": {
                    const catModel = (prisma as any).category;
                    if (!catModel) throw new Error("Prisma'da Category model yo'q (schema.prisma + migrate kerak).");
                    const c = it.payload;
                    await catModel.upsert({
                        where: { id: String(c.id) },
                        create: { id: String(c.id), name: String(c.name) },
                        update: { name: String(c.name) },
                    });
                    break;
                }
                case "category_remove":
                case "category:remove": {
                    const catModel = (prisma as any).category;
                    if (!catModel) throw new Error("Prisma'da Category model yo'q (schema.prisma + migrate kerak).");
                    await catModel.delete({ where: { id: String(it.payload.id) } });
                    break;
                }

                // ---------- SALES ----------
                case "sale_create":
                case "sale:add": {
                    const s = it.payload;

                    await prisma.store.upsert({
                        where: { id: String(s.storeId) },
                        create: {
                            id: String(s.storeId),
                            name: s.storeName ?? `Recovered-${String(s.storeId).slice(0, 6)}`,
                            type: "branch",
                            prices: {},
                        },
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
                            createdAt: new Date(Number(s.created_at ?? s.createdAt ?? Date.now())),
                        },
                    });
                    break;
                }
                case "sale_update":
                case "sale:update": {
                    const patch = it.payload.patch ?? it.payload;
                    await prisma.sale.update({
                        where: { id: String(it.payload.id) },
                        data: {
                            ...(patch.qty !== undefined ? { qty: patch.qty } : {}),
                            ...(patch.price !== undefined ? { price: patch.price } : {}),
                        },
                    });
                    break;
                }
                case "sale_remove":
                case "sale:remove": {
                    await prisma.sale.delete({ where: { id: String(it.payload.id) } });
                    break;
                }

                // ---------- RETURNS ----------
                case "return_create":
                case "return:add": {
                    const r = it.payload;

                    await prisma.store.upsert({
                        where: { id: String(r.storeId) },
                        create: {
                            id: String(r.storeId),
                            name: r.storeName ?? `Recovered-${String(r.storeId).slice(0, 6)}`,
                            type: "branch",
                            prices: {},
                        },
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
                            createdAt: new Date(Number(r.created_at ?? r.createdAt ?? Date.now())),
                        },
                    });
                    break;
                }
                case "return_update":
                case "return:update": {
                    const patch = it.payload.patch ?? it.payload;
                    await prisma.return.update({
                        where: { id: String(it.payload.id) },
                        data: {
                            ...(patch.qty !== undefined ? { qty: patch.qty } : {}),
                            ...(patch.price !== undefined ? { price: patch.price } : {}),
                        },
                    });
                    break;
                }
                case "return_remove":
                case "return:remove": {
                    await prisma.return.delete({ where: { id: String(it.payload.id) } });
                    break;
                }

                // ---------- CASH ----------
                case "cash_create":
                case "cash:add": {
                    const c = it.payload;

                    await prisma.store.upsert({
                        where: { id: String(c.storeId) },
                        create: {
                            id: String(c.storeId),
                            name: `Recovered-${String(c.storeId).slice(0, 6)}`,
                            type: "branch",
                            prices: {},
                        },
                        update: {},
                    });

                    await prisma.cashReceipt.create({
                        data: {
                            id: String(c.id),
                            storeId: String(c.storeId),
                            amount: c.amount,
                            createdAt: new Date(Number(c.created_at ?? c.createdAt ?? Date.now())),
                            note: null,
                        },
                    });
                    break;
                }
                case "cash_update":
                case "cash:update": {
                    // app payload: {id, amount} bo'lishi mumkin
                    const amount = it.payload.amount ?? it.payload?.patch?.amount;
                    await prisma.cashReceipt.update({
                        where: { id: String(it.payload.id) },
                        data: { amount: Number(amount) },
                    });
                    break;
                }
                case "cash_remove":
                case "cash:remove": {
                    await prisma.cashReceipt.delete({ where: { id: String(it.payload.id) } });
                    break;
                }

                default:
                    throw new Error(`Unknown queue item: ${k}`);
            }

            appliedIds.push(it.id);
        } catch (e: any) {
            failed.push({ id: it.id, error: e?.message ?? "failed" });
        }
    }

    return { appliedIds, failed, serverTime: Date.now() };
}

export async function snapshot() {
    const catModel = (prisma as any).category;

    const [stores, products, categories, sales, returns, cashReceipts] = await Promise.all([
        prisma.store.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.product.findMany({ orderBy: { createdAt: "asc" } }),
        catModel ? catModel.findMany({ orderBy: { createdAt: "asc" } }) : Promise.resolve([]),
        prisma.sale.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.return.findMany({ orderBy: { createdAt: "asc" } }),
        prisma.cashReceipt.findMany({ orderBy: { createdAt: "asc" } }),
    ]);

    return {
        stores,
        products,
        categories,
        sales,
        returns,
        cash_receipts: cashReceipts, // eski key
        cashReceipts: cashReceipts,  // yangi key
        serverTime: Date.now(),
    };
}
