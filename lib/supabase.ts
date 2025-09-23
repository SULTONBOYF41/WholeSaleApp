// lib/supabase.ts
import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const url =
    (Constants.expoConfig?.extra?.SUPABASE_URL ||
        process.env.EXPO_PUBLIC_SUPABASE_URL ||
        "") as string;

const anon =
    (Constants.expoConfig?.extra?.SUPABASE_ANON_KEY ||
        process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
        "") as string;

// Majburiy tekshiruv (kritik holat) — bunisiz app ishlamaydi.
// Xohlasangiz shu ogohlantirishni ham olib tashlashingiz mumkin.
if (!url || !anon) {
    console.warn(
        "[Supabase] Config topilmadi (URL/ANON). app.config.* yoki .env ni tekshiring."
    );
}

export const supabase = createClient(url, anon, {
    realtime: { params: { eventsPerSecond: 5 } },
    auth: { persistSession: false },
});