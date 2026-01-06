import { prisma } from "../db";

export async function listExpenses() {
    return prisma.expense.findMany({ orderBy: { createdAt: "desc" } });
}

export async function replaceExpenseBatch(batchId: string, kind: "family" | "shop" | "bank", rows: any[]) {
    // Atomik qilish uchun transaction
    return prisma.$transaction(async (tx) => {
        await tx.expense.deleteMany({ where: { batchId } });

        const created = await tx.expense.createMany({
            data: rows.map((r) => ({
                clientId: String(r.client_id),
                batchId,
                kind,
                title: String(r.title),
                qty: r.qty ?? null,
                price: r.price ?? null,
                amount: r.amount,
                note: r.note ?? null,
                createdAt: new Date(r.created_at),
            })),
        });

        return created;
    });
}

export async function deleteExpenseBatch(batchId: string) {
    await prisma.expense.deleteMany({ where: { batchId } });
}
