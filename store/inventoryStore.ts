import { create } from "zustand";
import { getJSON, setJSON, K } from "@/lib/storage";

type Sale = {
    id: string;
    name: string;
    qty: number;
    unit: "dona" | "kg";
    sale_price: number;
};

type State = {
    sales: Sale[];
    addSale: (s: Sale) => Promise<void>;
    load: () => Promise<void>;
};

export const useInventoryStore = create<State>()((set, get) => ({
    sales: [],
    load: async () => {
        const saved = await getJSON<Sale[]>(K.SALES, []);
        set({ sales: saved });
    },
    addSale: async (s) => {
        const list = [...get().sales, s];
        set({ sales: list });
        await setJSON(K.SALES, list);
    },
}));

// App ochilganda bir marta chaqirishni unutmang:
// useEffect(() => { useInventoryStore.getState().load(); }, []);
