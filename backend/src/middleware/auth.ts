import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export type AuthPayload = { sub: string; role: "admin" };

export function authRequired(req: Request, res: Response, next: NextFunction) {
    const h = req.headers.authorization || "";
    const token = h.startsWith("Bearer ") ? h.slice(7) : "";
    if (!token) return res.status(401).json({ ok: false, error: "Missing token" });

    try {
        const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
        (req as any).auth = payload;
        next();
    } catch {
        return res.status(401).json({ ok: false, error: "Invalid token" });
    }
}
