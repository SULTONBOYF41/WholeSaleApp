// lib/net.ts
import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import NetInfo, { NetInfoSubscription } from "@react-native-community/netinfo";
import { useEffect } from "react";

export function useNetWatcher() {
    const setOnline = useSyncStore((s) => s.setOnline);

    useEffect(() => {
        let sub: NetInfoSubscription | null = NetInfo.addEventListener(async (state) => {
            const isOn = !!(state.isConnected && state.isInternetReachable !== false);
            const prev = useSyncStore.getState().online;
            setOnline(isOn);

            // Online bo'ldi — navbatni yubor + appStore push/pull
            if (!prev && isOn) {
                try {
                    await useSyncStore.getState().processQueue(); // sales queue
                } catch { }
                try {
                    await useAppStore.getState().pushNow();       // store/product/sale/return queue
                    await useAppStore.getState().pullNow();
                } catch { }
            }
        });

        // Initial fetch
        NetInfo.fetch().then((state) => {
            const isOn = !!(state.isConnected && state.isInternetReachable !== false);
            setOnline(isOn);
        });

        return () => { sub?.(); sub = null; };
    }, [setOnline]);
}
