import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { authRequired } from "../middleware/auth";
import { applyQueue, snapshot } from "../services/sync.service";

export const syncRouter = Router();

syncRouter.get(
    "/snapshot",
    authRequired,
    asyncHandler(async (_req, res) => {
        const data = await snapshot();
        res.json({ ok: true, ...data });
    })
);

syncRouter.post(
    "/push",
    authRequired,
    asyncHandler(async (req, res) => {
        const body = z.object({ items: z.array(z.any()) }).parse(req.body);
        const r = await applyQueue(body.items as any[]);
        res.json({ ok: true, ...r });
    })
);
