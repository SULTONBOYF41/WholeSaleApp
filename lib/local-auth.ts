// lib/local-auth.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

// ✅ API token bilan aralashmasligi uchun alohida key
const AUTH_KEY = "local_auth_ok_v1";

const LOGIN = "akmalaminov";
const PASS = "21121982";

export async function signInLocal(email: string, pass: string) {
    if (email === LOGIN && pass === PASS) {
        await AsyncStorage.setItem(AUTH_KEY, "ok");
        return { ok: true as const };
    }
    return { ok: false as const, message: "Логин ёки парол нотўғри" };
}

export async function isSignedIn() {
    return (await AsyncStorage.getItem(AUTH_KEY)) === "ok";
}

export async function signOutLocal() {
    await AsyncStorage.removeItem(AUTH_KEY);
}
