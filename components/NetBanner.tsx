// components/NetBanner.tsx
import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useRef, useState } from "react";
import {
    Animated,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

// Biz yaratgan offline navbat kalitlari
const QUEUE_KEYS = ["expenses_queue_v1"];

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
    const [queued, setQueued] = useState(0);
    const [pushing, setPushing] = useState(false);

    // ⚠️ height va opacity uchun native driver ishlatilmaydi
    const heightAnim = useRef(new Animated.Value(0)).current;
    const opacityAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        const targetH = 40; // doim 40px ko'rsak ham bo'ladi, matn sig'adi
        Animated.parallel([
            Animated.timing(heightAnim, { toValue: targetH, duration: 200, useNativeDriver: false }),
            Animated.timing(opacityAnim, { toValue: 1, duration: 200, useNativeDriver: false }),
        ]).start();
    }, []);

    // Online holatini kuzatamiz va push/pull trigger
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
                    // online bo'ldi -> push, so'ng pull
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

    // Navbat sonini AsyncStorage'dan o'qib turamiz
    async function readQueueCount() {
        try {
            let sum = 0;
            for (const key of QUEUE_KEYS) {
                const raw = await AsyncStorage.getItem(key);
                if (raw) {
                    const arr = JSON.parse(raw);
                    if (Array.isArray(arr)) sum += arr.length;
                }
            }
            setQueued(sum);
        } catch {
            // ignore
        }
    }

    useEffect(() => {
        // boshlang'ich o'qish
        readQueueCount();
        // har 1.5s da tekshir (yengil polling, event yo'q)
        const t = setInterval(readQueueCount, 1500);
        return () => clearInterval(t);
    }, []);

    const onRetryOrSync = async () => {
        const { pushNow, pullNow } = useAppStore.getState();
        try {
            setPushing(true);
            await pushNow();
            await pullNow();
        } catch {
            // ignore
        } finally {
            setPushing(false);
            readQueueCount();
        }
    };

    const bg = online ? COLORS.greenBg : COLORS.redBg;
    const border = online ? COLORS.greenBorder : COLORS.redBorder;
    const dot = online ? COLORS.greenDot : COLORS.redDot;

    const leftIcon = online ? "checkmark-circle" : "cloud-offline";

    const statusText = online ? "Онлайн" : "Оффлайн режим: амаллар навбатга сақланади";
    const queueText =
        queued > 0 ? ` • Навбатда: ${queued} амал` : online ? " • Навбат йўқ" : "";

    return (
        <Animated.View
            style={[
                styles.wrap,
                { height: heightAnim, opacity: opacityAnim, backgroundColor: bg, borderBottomColor: border },
            ]}
        >
            <View style={styles.inner}>
                <Ionicons name={leftIcon as any} size={18} color={dot} style={{ marginRight: 6 }} />
                <View style={[styles.dot, { backgroundColor: dot }]} />
                <Text style={styles.text} numberOfLines={1}>
                    {statusText}
                    <Text style={{ fontWeight: "700" }}>{queueText}</Text>
                </Text>

                {(!online || queued > 0) && (
                    <TouchableOpacity
                        onPress={onRetryOrSync}
                        style={[styles.retryBtn, !online ? styles.retryDanger : styles.retryNeutral]}
                        accessibilityRole="button"
                    >
                        <Text style={[styles.retryText, !online && { color: COLORS.primary }]}>
                            {pushing ? (online ? "Sync..." : "Retry...") : online ? "Sync" : "Retry"}
                        </Text>
                    </TouchableOpacity>
                )}
            </View>
        </Animated.View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        borderBottomWidth: 1,
    },
    inner: {
        flex: 1,
        minHeight: Platform.select({ ios: 40, android: 40 })!,
        paddingHorizontal: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        paddingTop: Platform.OS === "android" ? 2 : 0,
    },
    text: { flex: 1, color: COLORS.text, fontWeight: "700" },
    dot: { width: 8, height: 8, borderRadius: 4 },
    retryBtn: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 10,
        borderWidth: 1,
    },
    retryDanger: {
        backgroundColor: COLORS.redBtnBg,
        borderColor: COLORS.redBtnBorder,
    },
    retryNeutral: {
        backgroundColor: "#fff",
        borderColor: "#e8e8ef",
    },
    retryText: { fontWeight: "800" },
});
