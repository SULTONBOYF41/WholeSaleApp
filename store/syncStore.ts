// store/syncStore.ts
import { getJSON, K, setJSON } from "@/lib/storage";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/appStore";
import { create } from "zustand";

type QueueItem = { type: "sale_create"; payload: any; id: string };

type SyncState = {
    online: boolean;
    lastChangeAt: number;

    queue: QueueItem[];
    setOnline: (v: boolean) => void;

    pushSale: (payload: any) => Promise<void>;
    processQueue: () => Promise<void>;
    load: () => Promise<void>;
    clearAll: () => Promise<void>;
};

export const useSyncStore = create<SyncState>()((set, get) => ({
    online: true,
    lastChangeAt: Date.now(),

    queue: [],
    setOnline(v) { set({ online: v, lastChangeAt: Date.now() }); },

    async load() {
        const q = await getJSON<QueueItem[]>(K.QUEUE, []);
        set({ queue: q });
    },

    async pushSale(payload) {
        const item: QueueItem = { id: Date.now().toString(), type: "sale_create", payload };
        const q = [...get().queue, item];
        set({ queue: q });
        await setJSON(K.QUEUE, q);

        // Agar hozir online bo'lsa, darrov urinamiz:
        if (get().online) {
            await get().processQueue();
            // appStore navbatlari ham bo'lsa — pushNow/pullNow:
            try { await useAppStore.getState().pushNow(); await useAppStore.getState().pullNow(); } catch { }
        }
    },

    async processQueue() {
        const q = [...get().queue];
        if (!q.length) return;

        const rest: QueueItem[] = [];
        for (const it of q) {
            try {
                if (it.type === "sale_create") {
                    const s = it.payload;
                    // SIZNING appStore.pushNow() bilan 1 xil mapping:
                    const { error } = await supabase.from("sales").insert({
                        id: s.id,
                        store_id: s.storeId,
                        product_name: s.productName,
                        qty: s.qty,
                        unit: s.unit,
                        price: s.price,
                        created_at: new Date(s.created_at).toISOString(),
                    });
                    if (error) throw error;
                }
            } catch {
                rest.push(it); // offline yoki RLS xatosi — qoldiramiz
            }
        }

        set({ queue: rest });
        await setJSON(K.QUEUE, rest);
    },

    async clearAll() {
        set({ queue: [] });
        await setJSON(K.QUEUE, []);
        await setJSON(K.SALES, []);
    },
}));
