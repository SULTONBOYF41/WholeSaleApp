import { prisma } from "../db";

export async function listCashReceipts(storeId: string) {
    return prisma.cashReceipt.findMany({
        where: { storeId },
        orderBy: { createdAt: "desc" },
    });
}
