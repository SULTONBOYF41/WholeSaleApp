import type { Request, Response, NextFunction } from "express";

export function errorMiddleware(err: any, _req: Request, res: Response, _next: NextFunction) {
    const msg = err?.message ?? "Server error";
    const status = Number(err?.statusCode ?? 500);
    if (status >= 500) console.error("[ERR]", err);
    res.status(status).json({ ok: false, error: msg });
}
