// lib/api.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL =
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    "http://178.18.245.174:3000"; // fallback: VPS IP

const TOKEN_KEY = "auth_token_v1";

async function getToken() {
    return (await AsyncStorage.getItem(TOKEN_KEY)) || "";
}

async function setToken(token: string) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
}

async function clearToken() {
    await AsyncStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
    path: string,
    opts: RequestInit & { auth?: boolean } = {}
): Promise<T> {
    const url = `${BASE_URL}${path.startsWith("/") ? "" : "/"}${path}`;
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(opts.headers as any),
    };

    if (opts.auth !== false) {
        const token = await getToken();
        if (token) headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(url, { ...opts, headers });
    const text = await res.text();
    let json: any = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }

    if (!res.ok) {
        const msg = json?.message || json?.error || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return json as T;
}

export const api = {
    baseUrl: BASE_URL,
    auth: {
        async login(login: string, pass: string) {
            const r = await request<{ ok: boolean; token: string }>("/api/auth/login", {
                method: "POST",
                auth: false,
                body: JSON.stringify({ login, pass }),
            });
            if (r?.token) await setToken(r.token);
            return r;
        },
        getToken,
        setToken,
        clearToken,
    },

    sync: {
        snapshot() {
            return request<any>("/api/sync/snapshot", { method: "GET" });
        },
        push(items: any[]) {
            return request<any>("/api/sync/push", {
                method: "POST",
                body: JSON.stringify({ items }),
            });
        },
    },

    cash: {
        list(storeId: string) {
            const q = new URLSearchParams({ store_id: storeId });
            return request<{ ok: boolean; data: any[] }>(`/api/cash-receipts?${q.toString()}`, { method: "GET" });
        },
    },

    expenses: {
        list() {
            return request<{ ok: boolean; data: any[] }>("/api/expenses", { method: "GET" });
        },
        replaceBatch(batchId: string, payload: any) {
            return request<{ ok: boolean }>(`/api/expenses/batch/${batchId}`, {
                method: "PUT",
                body: JSON.stringify(payload),
            });
        },
        deleteBatch(batchId: string) {
            return request<{ ok: boolean }>(`/api/expenses/batch/${batchId}`, { method: "DELETE" });
        },
    },
};
