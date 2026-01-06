import { Router } from "express";
import { authRouter } from "./auth";
import { syncRouter } from "./sync";
import { expensesRouter } from "./expenses";
import { cashRouter } from "./cash";

export const apiRouter = Router();

apiRouter.get("/health", (_req, res) => res.json({ ok: true }));

apiRouter.use("/auth", authRouter);
apiRouter.use("/sync", syncRouter);
apiRouter.use("/expenses", expensesRouter);
apiRouter.use("/cash-receipts", cashRouter);
