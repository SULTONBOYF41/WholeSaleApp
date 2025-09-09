import AsyncStorage from "@react-native-async-storage/async-storage";

export const K = {
    STORES: "stores",
    CATEGORIES: "categories",
    PRODUCTS: "products",
    SALES: "sales",
    RETURNS: "returns",
    QUEUE: "queue",
    META: "meta",
    CASH: "cash_receipts", // <-- yangi
};

export async function getJSON<T>(key: string, fallback: T): Promise<T> {
    try { const raw = await AsyncStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
}
export async function setJSON<T>(key: string, value: T) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
}
