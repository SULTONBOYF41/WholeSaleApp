import { createClient } from "@supabase/supabase-js";
import Constants from "expo-constants";

const url = Constants.expoConfig?.extra?.SUPABASE_URL as string;
const anon = Constants.expoConfig?.extra?.SUPABASE_ANON_KEY as string;

export const supabase = createClient(url, anon, {
    realtime: { params: { eventsPerSecond: 5 } },
    auth: { persistSession: false } // biz auth ishlatmaymiz
});
