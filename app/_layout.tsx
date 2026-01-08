// app/_layout.tsx
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useEffect } from "react";
import "react-native-gesture-handler";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import "@/store/appStore.fix";


import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";

export default function RootLayout() {
  useEffect(() => {
    (async () => {
      // ✅ network watcher
      try {
        useSyncStore.getState().initNetWatcher?.();
      } catch { }

      // ✅ zustand persist rehydrate
      try {
        // @ts-ignore
        await useAppStore.persist.rehydrate?.();
      } catch (e) {
        console.log("rehydrate error", e);
      }

      // ✅ backward compat: hydrate() ham bor, init() ham bor
      try {
        await (useAppStore.getState().hydrate?.() ?? Promise.resolve());
      } catch { }
      try {
        await (useAppStore.getState().init?.() ?? Promise.resolve());
      } catch { }
    })();
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false }} />
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
