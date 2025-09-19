// store/syncStore.ts
import { useAppStore } from "@/store/appStore";
import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";

/**
 * Tarmoq holati (online/offline) va online bo‘lganda push→pull orkestratsiya.
 * Supabase’ga to‘g‘ridan-to‘g‘ri CRUD qilmaydi — barchasi appStore ichida.
 */

type SyncState = {
    online: boolean;
    lastChangeAt: number;

    setOnline: (v: boolean) => void;
    initNetWatcher: () => void;

    // Orkestratsiya helperlari:
    pushAndPullNow: () => Promise<void>;

    // Backward-compat (no-op yoki appStore orqali):
    load: () => Promise<void>;
    pushSale: (payload: any) => Promise<void>;
    processQueue: () => Promise<void>;
    clearAll: () => Promise<void>;
};

let watcherStarted = false;

export const useSyncStore = create<SyncState>()((set, get) => ({
    online: true,
    lastChangeAt: Date.now(),

    setOnline(v) {
        const prev = get().online;
        set({ online: v, lastChangeAt: Date.now() });

        // Offline -> Online: avtomatik push→pull
        if (!prev && v) {
            get().pushAndPullNow().catch(() => { });
        }
    },

    initNetWatcher() {
        if (watcherStarted) return;
        watcherStarted = true;

        // Boshlang‘ich holat
        NetInfo.fetch().then((state) => {
            const on = !!state.isConnected && (state.isInternetReachable ?? true);
            get().setOnline(on);
        });

        // Listener
        NetInfo.addEventListener((state) => {
            const on = !!state.isConnected && (state.isInternetReachable ?? true);
            if (on !== get().online) get().setOnline(on);
        });
    },

    // >>> YANGI: push→pull orkestratsiyasi (AddStore bundan foydalanadi)
    async pushAndPullNow() {
        const { pushNow, pullNow } = useAppStore.getState();
        try {
            await pushNow();       // lokal queue -> server (push)
        } catch {
            // offline yoki boshqa xatolar bo‘lishi mumkin — appStore o‘zi handle qiladi
        }
        try {
            await pullNow();       // so‘ng serverdan yangi snapshot (pull)
        } catch {
            // ignorable
        }
    },

    // === Backward-compat helperlar ===
    async load() {
        return;
    },

    async pushSale(_payload: any) {
        // NO-OP: boshqa sahifa boshqaradi
        return;
    },

    async processQueue() {
        const { pushNow } = useAppStore.getState();
        try { await pushNow(); } catch { }
    },

    async clearAll() {
        return;
    },
}));
