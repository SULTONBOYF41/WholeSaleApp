import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { config } from "../config";

export async function loginAdmin(login: string, pass: string) {
    // Hozircha oddiy: envdagi login/pass bilan
    if (login !== config.adminLogin) return null;

    // passni hozircha plain qoldiramiz (sizda shunaqa edi).
    // Xohlasangiz: ADMIN_PASS_HASH formatga o‘tkazamiz.
    if (pass !== config.adminPass) return null;

    const token = jwt.sign({ sub: "admin", role: "admin" }, config.jwtSecret, {
        expiresIn: config.jwtExpiresIn,
    });
    return { token };
}
