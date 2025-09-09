// app.config.ts
import { ExpoConfig } from "expo/config";

export default (): ExpoConfig => ({
    name: "Wholesale App",
    slug: "wholesale-app",
    scheme: "wholesaleapp",
    version: "1.0.0",
    extra: {
        SUPABASE_URL: process.env.SUPABASE_URL,
        SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY,
    },
    experiments: { typedRoutes: true },
    // ❌ plugins ichida reanimated yo'q! faqat expo-router bo‘lishi mumkin.
    plugins: ["expo-router"],
});
