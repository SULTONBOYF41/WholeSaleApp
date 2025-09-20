// app.config.ts
import 'dotenv/config';
import type { ExpoConfig } from "expo/config";
// Agar app.json’dan qiymat o‘qimoqchi bo‘lsangiz (ixtiyoriy):
// const staticCfg = require("./app.json"); // { expo: { ... } }

export default (): ExpoConfig => ({
    name: "SavdoHisobi",
    slug: "savdohisobi",
    scheme: "wholesaleapp",
    version: "1.0.0",

    experiments: { typedRoutes: true },

    android: {
        package: "com.ruhshonatortapps.SavdoHisobi",
        "versionCode": 1
    },

    ios: {
        bundleIdentifier: "com.ruhshonatortapps.SavdoHisobi"
    },

    updates: {
        enabled: true,
        checkAutomatically: "ON_LOAD",
        fallbackToCacheTimeout: 0,
        url: "https://u.expo.dev/1333c9b1-8910-4a25-9354-97cf2d39be36", // ← EAS Update URL
    },


    runtimeVersion: "1.0.0", // <<<<<<<<< MUHIM: bare workflow uchun qat’iy satr
    

    "owner": "ruhshonatortapps",


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
            projectId: "1333c9b1-8910-4a25-9354-97cf2d39be36",
        },
    },

    plugins: [
        "expo-router",
        "expo-font",
        "expo-secure-store",
        "expo-web-browser",
    ],
});

