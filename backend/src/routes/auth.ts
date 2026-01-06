import { Router } from "express";
import { z } from "zod";
import { asyncHandler } from "../utils/asyncHandler";
import { loginAdmin } from "../services/auth.service";

export const authRouter = Router();

authRouter.post(
    "/login",
    asyncHandler(async (req, res) => {
        const body = z.object({ login: z.string().min(1), pass: z.string().min(1) }).parse(req.body);
        const r = await loginAdmin(body.login, body.pass);
        if (!r) return res.status(401).json({ ok: false, error: "Login yoki parol noto‘g‘ri" });
        res.json({ ok: true, ...r });
    })
);
