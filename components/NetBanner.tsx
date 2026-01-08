// components/NetBanner.tsx
import { useAppStore } from "@/store/appStore";
import { useExpensesStore } from "@/store/expensesStore";
import { useSyncStore } from "@/store/syncStore";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

const PRIMARY = "#770E13";

export default function NetBanner() {
    const online = useSyncStore((s) => s.online);
    const initNetWatcher = useSyncStore((s) => s.initNetWatcher);
    const pushAndPullNow = useSyncStore((s) => s.pushAndPullNow);

    const appQ = useAppStore((s) => s.queue.length);
    const expQ = useExpensesStore((s: any) => (Array.isArray(s.queue) ? s.queue.length : 0));

    const [busy, setBusy] = useState(false);

    useEffect(() => {
        initNetWatcher();
    }, [initNetWatcher]);

    const total = appQ + expQ;

    const statusText = useMemo(() => {
        if (!online) return "Offline";
        if (total > 0) return `Online • ${total} ta navbat`;
        return "Online";
    }, [online, total]);

    const onSync = async () => {
        if (busy) return;
        setBusy(true);
        try {
            await pushAndPullNow();
        } finally {
            setBusy(false);
        }
    };

    return (
        <View style={[styles.wrap, !online && styles.off]}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flex: 1 }}>
                <Ionicons name={online ? "wifi" : "wifi-outline"} size={18} color={online ? "#065F46" : "#991B1B"} />
                <Text style={styles.txt}>{statusText}</Text>
            </View>

            {online && total > 0 && (
                <TouchableOpacity onPress={onSync} style={[styles.btn, busy && { opacity: 0.6 }]} disabled={busy}>
                    <Text style={styles.btnTxt}>{busy ? "Sync..." : "Sync"}</Text>
                </TouchableOpacity>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flexDirection: "row",
        alignItems: "center",
        gap: 10,
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderColor: "#eee",
        backgroundColor: "#ECFDF5",
    },
    off: { backgroundColor: "#FEF2F2" },
    txt: { fontWeight: "800", color: "#111827" },
    btn: { backgroundColor: PRIMARY, paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10 },
    btnTxt: { color: "#fff", fontWeight: "900" },
});
