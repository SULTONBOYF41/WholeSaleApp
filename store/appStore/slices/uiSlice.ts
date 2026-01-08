// store/appStore/slices/uiSlice.ts
import type { StateCreator } from "zustand";
import type { AppState } from "../index";

export type UiSlice = {
    menuOpen: boolean;
    setMenu: (open: boolean) => void;
    toggleMenu: () => void;

    currentStoreId: string | null;
    setCurrentStore: (storeId: string | null) => void;
};

export const createUiSlice: StateCreator<
    AppState,
    [["zustand/persist", unknown]],
    [],
    UiSlice
> = (set) => ({
    menuOpen: false,
    setMenu: (open) => set({ menuOpen: !!open }),
    toggleMenu: () => set((s) => ({ menuOpen: !s.menuOpen })),

    currentStoreId: null,
    setCurrentStore: (storeId) => set({ currentStoreId: storeId }),
});
