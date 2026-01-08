// store/toastStore.ts
import { create } from "zustand";

type Mode = "toast" | "loading";

type ToastState = {
    visible: boolean;
    text: string;
    mode: Mode;

    show: (text: string, duration?: number) => void;
    showLoading: (text: string, duration?: number) => void;
    hide: () => void;
};

let timer: ReturnType<typeof setTimeout> | null = null;

function clearTimer() {
    if (timer) {
        clearTimeout(timer);
        timer = null;
    }
}

export const useToastStore = create<ToastState>((set, get) => ({
    visible: false,
    text: "",
    mode: "toast",

    show: (text, duration = 1800) => {
        clearTimer();
        set({ visible: true, text, mode: "toast" });
        if (duration > 0) {
            timer = setTimeout(() => {
                if (get().text === text) set({ visible: false });
            }, duration);
        }
    },

    showLoading: (text, duration = 1200) => {
        clearTimer();
        set({ visible: true, text, mode: "loading" });
        if (duration > 0) {
            timer = setTimeout(() => {
                if (get().text === text) set({ visible: false });
            }, duration);
        }
    },

    hide: () => {
        clearTimer();
        set({ visible: false });
    },
}));
