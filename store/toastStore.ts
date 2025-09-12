import { create } from "zustand";

type Mode = "toast" | "loading";

type ToastState = {
    visible: boolean;
    text: string;
    mode: Mode;
    show: (text: string, duration?: number) => void;          // pastdagidek oddiy xabar (auto-hide)
    showLoading: (text: string, duration?: number) => void;    // markazda spinner (auto-hide)
    hide: () => void;
};

export const useToastStore = create<ToastState>((set, get) => ({
    visible: false,
    text: "",
    mode: "toast",
    show: (text, duration = 1800) => {
        set({ visible: true, text, mode: "toast" });
        if (duration > 0) setTimeout(() => {
            if (get().text === text) set({ visible: false });
        }, duration);
    },
    showLoading: (text, duration = 1200) => {
        set({ visible: true, text, mode: "loading" });
        if (duration > 0) setTimeout(() => {
            if (get().text === text) set({ visible: false });
        }, duration);
    },
    hide: () => set({ visible: false }),
}));
