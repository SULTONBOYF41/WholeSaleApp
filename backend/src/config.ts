import "dotenv/config";

function req(name: string): string {
    const v = process.env[name];
    if (!v) throw new Error(`Missing env: ${name}`);
    return v;
}

export const config = {
    nodeEnv: process.env.NODE_ENV ?? "development",
    port: Number(process.env.PORT ?? 3000),
    databaseUrl: req("DATABASE_URL"),
    jwtSecret: req("JWT_SECRET"),
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? "30d",
    adminLogin: req("ADMIN_LOGIN"),
    adminPass: req("ADMIN_PASS"),
};
