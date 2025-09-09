import AsyncStorage from "@react-native-async-storage/async-storage";
const AUTH_KEY = "auth_token";
const LOGIN = "admin@local.app";
const PASS = "123456";

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
