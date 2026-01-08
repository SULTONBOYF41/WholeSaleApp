// app.config.ts
import "dotenv/config";
import type { ExpoConfig } from "expo/config";

export default (): ExpoConfig => ({
  name: "SavdoHisobi",
  slug: "savdohisobi",
  version: "1.0.1",
  runtimeVersion: "1.0.1",

  // ✅ Linking warning uchun eng muhim fix:
  scheme: "savdohisobi",

  experiments: { typedRoutes: true },

  // ✅ Expo Router ishlatayotgan bo‘lsangiz plugin qo‘shib qo‘ying (safe)
  plugins: ["expo-router"],

  updates: {
    enabled: true,
    checkAutomatically: "ON_LOAD",
    fallbackToCacheTimeout: 0,
    url: "https://u.expo.dev/f3ecb9e7-108f-4388-a74d-a2418c05d415",
  },

  owner: "ruhshonatortapps",

  extra: {
    SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
    SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
    eas: {
      projectId: "f3ecb9e7-108f-4388-a74d-a2418c05d415",
    },
  },
});
