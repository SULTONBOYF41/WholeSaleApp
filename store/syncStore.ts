// store/syncStore.ts
import { useAppStore } from "@/store/appStore";
import NetInfo from "@react-native-community/netinfo";
import { create } from "zustand";

/**
 * Bu store faqat tarmoq holatini boshqaradi (online/offline)
 * va online qaytganda AppStore navbatini (queue) push/pull qiladi.
 * Supabase'ga bevosita insert/delete/update QILMAYDI — barchasi appStore.pushNow() ichida.
 */

type SyncState = {
    online: boolean;
    lastChangeAt: number;

    // Online flag'ni qo'lda o'zgartirish (masalan, testda)
    setOnline: (v: boolean) => void;

    // NetInfo kuzatuvchini bir marta ishga tushirish
    initNetWatcher: () => void;

    // Quyidagilar backward-compat uchun qoldirildi (agar eski kod chaqirsa):
    // appStore navbati orqali proxylanadi yoki no-op bo'ladi.
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

        // Offline -> Online: avtomatik push/pull
        if (!prev && v) {
            const { pushNow, pullNow } = useAppStore.getState();
            pushNow().catch(() => { });
            setTimeout(() => pullNow().catch(() => { }), 200);
        }
    },

    initNetWatcher() {
        if (watcherStarted) return;
        watcherStarted = true;

        // Boshlang'ich holatni o'qish
        NetInfo.fetch().then((state) => {
            const on = !!state.isConnected && (state.isInternetReachable ?? true);
            get().setOnline(on);
        });

        // Listener
        NetInfo.addEventListener((state) => {
            const on = !!state.isConnected && (state.isInternetReachable ?? true);
            if (on !== get().online) {
                get().setOnline(on);
            }
        });
    },

    // === Backward-compat helperlar (agar eski kod ularga suyanayotgan bo'lsa) ===

    // Eski kod: local queue ni o'zi boshqarardi; endi navbat butunlay appStore tasarrufida.
    // Shuning uchun bu yerda faqat appStore.pushNow/pullNow ni urinamiz.
    async load() {
        // endi alohida queue yo‘q — hech narsa qilmaymiz
        return;
    },

    // Agar kimdir pushSale(payload) chaqirsa, appStore.addSale() ni chaqirish xatarli (dublikat bo‘lishi mumkin).
    // Shuning uchun bu helper NO-OP yoki kerak bo‘lsa shu yerda mapping qiling.
    async pushSale(_payload: any) {
        // NO-OP qilamiz (sotuvlar Sales sahifasida addSale() orqali kiritiladi)
        return;
    },

    async processQueue() {
        const { pushNow } = useAppStore.getState();
        try {
            await pushNow();
        } catch {
            // offline yoki RLS xatolar bo‘lishi mumkin — appStore ichida qayta re-queue bo‘ladi
        }
    },

    async clearAll() {
        // Navbatni tozalash uchun appStore ichidagi queue'ni boshqarish lozim bo‘lsa,
        // shu yerga appStore ichidagi storage tozalash kodini yozishingiz mumkin.
        // Hozirda NO-OP: appStore shu ishni o‘zi hal qiladi.
        return;
    },
}));
