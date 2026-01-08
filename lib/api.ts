// lib/api.ts
import AsyncStorage from "@react-native-async-storage/async-storage";

const BASE_URL =
    process.env.EXPO_PUBLIC_API_URL ||
    process.env.EXPO_PUBLIC_BACKEND_URL ||
    process.env.EXPO_PUBLIC_API_BASE ||
    "http://10.155.89.155:3000";

// ✅ asosiy token key
const TOKEN_KEY = "auth_token_v1";
// ✅ eski key (legacy/fallback)
const LEGACY_TOKEN_KEY = "auth_token";

async function getToken() {
    // 1) yangi key
    const t1 = (await AsyncStorage.getItem(TOKEN_KEY)) || "";
    if (t1 && t1 !== "ok") return t1;

    // 2) eski key bo'lsa ham o'qib ketamiz
    const t2 = (await AsyncStorage.getItem(LEGACY_TOKEN_KEY)) || "";
    // local-auth "ok" qilib qo'ygan bo'lishi mumkin — buni token deb yubormaymiz
    if (t2 && t2 !== "ok") return t2;

    return "";
}

async function setToken(token: string) {
    await AsyncStorage.setItem(TOKEN_KEY, token);
    // migration: eski key bo'lsa tozalab ketamiz
    try {
        await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch { }
}

async function clearToken() {
    await AsyncStorage.removeItem(TOKEN_KEY);
    try {
        await AsyncStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch { }
}

async function request<T>(path: string, opts: RequestInit & { auth?: boolean } = {}): Promise<T> {
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
    try {
        json = text ? JSON.parse(text) : null;
    } catch {
        json = null;
    }

    if (!res.ok) {
        const msg = json?.message || json?.error || `HTTP ${res.status}`;
        throw new Error(msg);
    }
    return json as T;
}

export const api = {
    baseUrl: BASE_URL,

    sync: {
        push(items: any[]) {
            return request<{ ok: boolean }>("/api/sync/push", {
                method: "POST",
                body: JSON.stringify({ items }),
            });
        },
        snapshot() {
            return request<any>("/api/sync/snapshot", { method: "GET" });
        },
    },

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
