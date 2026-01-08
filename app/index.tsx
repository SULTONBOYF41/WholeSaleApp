// app/index.tsx
import { api } from "@/lib/api";
import { useAppStore } from "@/store/appStore";
import { Redirect } from "expo-router";
import React, { useEffect, useState } from "react";

export default function Index() {
  const [ready, setReady] = useState(false);
  const [authed, setAuthed] = useState(false);

  const currentStoreId = useAppStore((s) => s.currentStoreId);

  useEffect(() => {
    (async () => {
      try {
        // ✅ app store init (hydrate/sync boot shu yerda bo‘lishi mumkin)
        const st: any = useAppStore.getState();
        if (typeof st.init === "function") {
          await st.init();
        }

        // ✅ tokenni api.ts saqlaydigan joydan tekshiramiz
        const token = await api.auth.getToken();
        setAuthed(!!token);
      } finally {
        setReady(true);
      }
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
