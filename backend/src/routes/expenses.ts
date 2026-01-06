import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { authRequired } from "../middleware/auth";
import { deleteExpenseBatch, listExpenses, replaceExpenseBatch } from "../services/expenses.service";

export const expensesRouter = Router();

expensesRouter.get(
    "/",
    authRequired,
    asyncHandler(async (_req, res) => {
        const data = await listExpenses();
        res.json({ ok: true, data });
    })
);

expensesRouter.put(
    "/batch/:batchId",
    authRequired,
    asyncHandler(async (req, res) => {
        const batchId = String(req.params.batchId);
        const body = z.object({
            kind: z.enum(["family", "shop", "bank"]),
            rows: z.array(
                z.object({
                    client_id: z.string().min(1),
                    title: z.string().min(1),
                    qty: z.number().nullable().optional(),
                    price: z.number().nullable().optional(),
                    amount: z.number(),
                    note: z.string().nullable().optional(),
                    created_at: z.string().min(1),
                })
            ),
        }).parse(req.body);

        await replaceExpenseBatch(batchId, body.kind, body.rows);
        res.json({ ok: true });
    })
);

expensesRouter.delete(
    "/batch/:batchId",
    authRequired,
    asyncHandler(async (req, res) => {
        await deleteExpenseBatch(String(req.params.batchId));
        res.json({ ok: true });
    })
);
