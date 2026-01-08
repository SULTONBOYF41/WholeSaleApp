import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { authRequired } from "../middleware/auth";
import { applyQueue, snapshot } from "../services/sync.service";

export const syncRouter = Router();

// ✅ Local curl test uchun: backend/.env ichida SYNC_REQUIRE_AUTH=0 qilsangiz auth o‘chadi
const REQUIRE_AUTH = process.env.SYNC_REQUIRE_AUTH !== "0";
const maybeAuth = (req: any, res: any, next: any) => (REQUIRE_AUTH ? authRequired(req, res, next) : next());

syncRouter.get(
  "/snapshot",
  maybeAuth,
  asyncHandler(async (_req, res) => {
    const data = await snapshot();
    res.json({ ok: true, ...data });
  })
);

syncRouter.post(
  "/push",
  maybeAuth,
  asyncHandler(async (req, res) => {
    // ✅ BOTH formats supported:
    // 1) { items: [...] }
    // 2) [ ... ]
    const parsed = z.union([z.array(z.any()), z.object({ items: z.array(z.any()) })]).parse(req.body);
    const items = Array.isArray(parsed) ? parsed : parsed.items;

    const r = await applyQueue(items as any[]);
    res.json({ ok: true, ...r });
  })
);
