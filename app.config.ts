// app.config.ts
import 'dotenv/config';
import type { ExpoConfig } from "expo/config";
// Agar app.json’dan qiymat o‘qimoqchi bo‘lsangiz (ixtiyoriy):
// const staticCfg = require("./app.json"); // { expo: { ... } }

export default (): ExpoConfig => ({
    name: "SavdoHisobi",
    slug: "SavdoHisobi",
    scheme: "wholesaleapp",
    version: "1.0.0",

    experiments: { typedRoutes: true },

    android: {
        package: "com.ruhshonatortapps.wholesaleapp"
    },

    ios: {
        bundleIdentifier: "com.ruhshonatortapps.wholesaleapp"
    },

    icon: "./assets/App-icon.png",
    splash: {
        image: "./assets/App-icon.png",
        resizeMode: "contain",   // yoki "cover"
        backgroundColor: "#F6EAD4"
    },

    extra: {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
        eas: {
            projectId: "185af514-ac28-4e82-985a-1b41493826fd",
        },
    },

    plugins: [
        "expo-router",
        "expo-font",
        "expo-secure-store",
        "expo-web-browser",
    ],
});

