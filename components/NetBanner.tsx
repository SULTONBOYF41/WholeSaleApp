// components/NetBanner.tsx
import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import { Ionicons } from "@expo/vector-icons";
import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useRef } from "react";
import { Animated, Platform, StyleSheet, Text, TouchableOpacity } from "react-native";

const COLORS = {
    text: "#1F2937",
    greenBg: "#ECFDF5",
    greenDot: "#059669",
    greenBorder: "#D1FAE5",
    redBg: "#FFF6F6",
    redDot: "#E23D3D",
    redBorder: "#F4C7CB",
    redBtnBg: "#FCE9EA",
    redBtnBorder: "#F4C7CB",
    primary: "#770E13",
};

export default function NetBanner() {
    const online = useSyncStore((s) => s.online);
    const setOnline = useSyncStore((s) => s.setOnline);

    // ⚠️ height va opacity uchun native driver ishlatilmaydi
    const heightAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const targetH = online ? 32 : 40;
        Animated.parallel([
            Animated.timing(heightAnim, { toValue: targetH, duration: 200, useNativeDriver: false }),
            Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        ]).start();
    }, [online, heightAnim, opacityAnim]);

    useEffect(() => {
        let mounted = true;

        NetInfo.fetch().then((state) => {
            if (!mounted) return;
            const on = !!state.isConnected && (state.isInternetReachable ?? true);
            setOnline(on);
        });

        const unsub = NetInfo.addEventListener((state) => {
            const on = !!state.isConnected && (state.isInternetReachable ?? true);
            const prev = useSyncStore.getState().online;
            if (prev !== on) {
                setOnline(on);
                if (!prev && on) {
                    const { pushNow, pullNow } = useAppStore.getState();
                    pushNow().catch(() => { });
                    setTimeout(() => pullNow().catch(() => { }), 250);
                }
            }
        });

        return () => {
            mounted = false;
            unsub();
        };
    }, [setOnline]);

    const onRetry = async () => {
        const { pushNow, pullNow } = useAppStore.getState();
        try { await pushNow(); } catch { }
        try { await pullNow(); } catch { }
    };

    const bg = online ? COLORS.greenBg : COLORS.redBg;
    const border = online ? COLORS.greenBorder : COLORS.redBorder;
    const dot = online ? COLORS.greenDot : COLORS.redDot;

    return (
        <Animated.View style={[styles.wrap, { height: heightAnim, opacity: opacityAnim, backgroundColor: bg, borderBottomColor: border }]}>
            <Animated.View style={styles.inner}>
                <Ionicons name={online ? "checkmark-circle" : "cloud-offline"} size={18} color={dot} style={{ marginRight: 6 }} />
                <Animated.View style={[styles.dot, { backgroundColor: dot }]} />
                <Text style={styles.text}>{online ? "Онлайн" : "Оффлайн режим: амаллар навбатга сақланади"}</Text>
                {!online && (
                    <TouchableOpacity onPress={onRetry} style={styles.retryBtn}>
                        <Text style={styles.retryText}>Retry</Text>
                    </TouchableOpacity>
                )}
            </Animated.View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        borderBottomWidth: 1,
    },
    inner: {
        flex: 1,
        minHeight: Platform.select({ ios: 32, android: 32 })!,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingTop: Platform.OS === "android" ? 2 : 0,
    },
    text: { flex: 1, color: COLORS.text, fontWeight: "700" },
    dot: { width: 8, height: 8, borderRadius: 4 },
    retryBtn: {
        paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8,
        backgroundColor: COLORS.redBtnBg, borderWidth: 1, borderColor: COLORS.redBtnBorder,
    },
    retryText: { color: COLORS.primary, fontWeight: "800" },
});
