// app.config.ts
import type { ExpoConfig } from "expo/config";
// Agar app.json’dan qiymat o‘qimoqchi bo‘lsangiz (ixtiyoriy):
// const staticCfg = require("./app.json"); // { expo: { ... } }

export default (): ExpoConfig => ({
    name: "Wholesale App",
    slug: "wholesale-app",
    scheme: "wholesaleapp",
    version: "1.0.0",

    experiments: { typedRoutes: true },

    extra: {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    },

    plugins: [
        "expo-router",
        "expo-font",
        "expo-secure-store",
        "expo-web-browser",
    ],

    // Agar app.json’dagi maydonlar bo‘lsa shu yerga qo‘shing:
    // icon: staticCfg.expo.icon,
    // splash: staticCfg.expo.splash,
    // android: staticCfg.expo.android,
    // ios: staticCfg.expo.ios,
});
