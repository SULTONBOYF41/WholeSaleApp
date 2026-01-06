import { Router } from "express";
import { asyncHandler } from "../utils/asyncHandler";
import { authRequired } from "../middleware/auth";
import { listCashReceipts } from "../services/cash.service";

export const cashRouter = Router();

cashRouter.get(
    "/",
    authRequired,
    asyncHandler(async (req, res) => {
        const storeId = String(req.query.store_id ?? "");
        if (!storeId) return res.status(400).json({ ok: false, error: "store_id required" });
        const data = await listCashReceipts(storeId);
        res.json({ ok: true, data });
    })
);
