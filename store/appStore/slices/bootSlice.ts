// store/appStore/slices/bootSlice.ts
import type { StateCreator } from "zustand";
import type { AppState } from "../index";

export type BootSlice = {
    hydrated: boolean;
    setHydrated: (v: boolean) => void;

    /**
     * Eski crash uchun BACKWARD-COMPAT:
     * ba’zi joylarda getState().hydrate() chaqirilgan bo‘lishi mumkin.
     */
    hydrate: () => Promise<void>;

    /** Sizning “init” */
    init: () => Promise<void>;
};

export const createBootSlice: StateCreator<
    AppState,
    [["zustand/persist", unknown]],
    [],
    BootSlice
> = (set) => ({
    hydrated: false,
    setHydrated: (v) => set({ hydrated: !!v }),

    hydrate: async () => {
        // backward-compat
        set({ hydrated: true });
    },

    init: async () => {
        set({ hydrated: true });
    },
});
