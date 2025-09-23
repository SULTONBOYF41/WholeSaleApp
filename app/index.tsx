// app/index.tsx
import { isSignedIn } from "@/lib/local-auth";
import { useAppStore } from "@/store/appStore";
import { Redirect } from "expo-router";
import { useEffect, useState } from "react";

export default function Index() {
    const [ready, setReady] = useState(false);
    const [authed, setAuthed] = useState(false);
    const currentStoreId = useAppStore((s) => s.currentStoreId);

    useEffect(() => {
        (async () => {
            await useAppStore.getState().init(); // startPull ichida
            setAuthed(await isSignedIn());
            setReady(true);
        })();
    }, []);



    if (!ready) return null;
    if (!authed) return <Redirect href="/(auth)/login" />;

    return currentStoreId
        ? <Redirect href={`/(main)/store/${currentStoreId}/dashboard`} />
        : <Redirect href="/(main)/home" />;
}
