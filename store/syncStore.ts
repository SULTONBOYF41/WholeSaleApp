// store/syncStore.ts
import { useAppStore } from "@/store/appStore";
import { useExpensesStore } from "@/store/expensesStore";
import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";

type SyncState = {
    online: boolean;
    lastChangeAt: number;

    setOnline: (v: boolean) => void;
    initNetWatcher: () => void;

    pushAndPullNow: () => Promise<void>;

    // backward-compat
    load: () => Promise<void>;
    pushSale: (_payload: any) => Promise<void>;
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

        // Offline -> Online bo‘lsa: queue -> pull
        if (!prev && v) {
            get().pushAndPullNow().catch(() => { });
        }
    },

    initNetWatcher() {
        if (watcherStarted) return;
        watcherStarted = true;

        NetInfo.fetch().then((state) => {
            const on = !!state.isConnected && (state.isInternetReachable ?? true);
            get().setOnline(on);
        });

        NetInfo.addEventListener((state) => {
            const on = !!state.isConnected && (state.isInternetReachable ?? true);
            if (on !== get().online) get().setOnline(on);
        });
    },

    async pushAndPullNow() {
        // 1) expenses queue
        try {
            await useExpensesStore.getState().processQueue();
        } catch { }

        // 2) core app queue (sales/returns/etc)
        const { pushNow, pullNow } = useAppStore.getState();
        try {
            await pushNow();
        } catch { }
        try {
            await pullNow();
        } catch { }

        // 3) expenses pull (hamma telefonda yangilansin)
        try {
            await useExpensesStore.getState().fetchAll();
        } catch { }
    },

    async load() {
        return;
    },
    async pushSale(_payload) {
        return;
    },
    async processQueue() {
        // eski: faqat appStore push
        try {
            await useExpensesStore.getState().processQueue();
        } catch { }
        const { pushNow } = useAppStore.getState();
        try {
            await pushNow();
        } catch { }
    },
    async clearAll() {
        return;
    },
}));
