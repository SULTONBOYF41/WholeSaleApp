// app/index.tsx
import { api } from "@/lib/api";
import { useAppStore } from "@/store/appStore";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);
  const currentStoreId = useAppStore((s) => s.currentStoreId);

  useEffect(() => {
    (async () => {
      // store init (startPull va boshqalar shu ichida bo'lishi mumkin)
      await useAppStore.getState().init();

      // ✅ tokenni aynan api.ts saqlaydigan joydan tekshiramiz
      const token = await api.auth.getToken();
      setAuthed(!!token);

      setReady(true);
    })();
  }, []);

  if (!ready) return null;
  if (!authed) return <Redirect href="/(auth)/login" />;

  return currentStoreId ? (
    <Redirect href={`/(main)/store/${currentStoreId}/dashboard`} />
  ) : (
    <Redirect href="/(main)/home" />
  );
}
