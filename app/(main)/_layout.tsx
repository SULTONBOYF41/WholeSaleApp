// app/(main)/_layout.tsx
import NetBanner from "@/components/NetBanner";
import StorePicker from "@/components/StorePicker";
import { signOutLocal } from "@/lib/local-auth";
import { useAppStore } from "@/store/appStore";
import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { Slot, router, usePathname } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
    Animated,
    Dimensions,
    Easing,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_W } = Dimensions.get("window");
const DRAWER_W = Math.min(300, Math.floor(SCREEN_W * 0.86));

// /(group) segmentlarni olib tashlab, trailing slashni tozalaymiz
const normalize = (p?: string | null) => {
    if (!p) return "/";
    let s = p.replace(/\/\([^/]+\)/g, "");
    if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
    return s;
};

const PICKER_PATHS = new Set(["/report", "/sales", "/returns", "/monitoring"]);

export default function MainLayout() {
    const menuOpen = useAppStore((s) => s.menuOpen);
    const setMenu = useAppStore((s) => s.setMenu);
    const currentStoreId = useAppStore((s) => s.currentStoreId);
    const stores = useAppStore((s) => s.stores);

    const pathname = usePathname();
    const np = normalize(pathname);

    // Header sarlavhasi
    const headerTitle = useMemo(() => {
        if (np.startsWith("/expenses")) {
            if (np.includes("/family")) return "Xarajatlar — Oilaviy";
            if (np.includes("/shop")) return "Xarajatlar — Do'kon";
            if (np.includes("/bank")) return "Xarajatlar — Bank";
            return "Xarajatlar — Hisobot";
        }
        if (np.startsWith("/admin")) {
            if (np.includes("/catalog")) return "Админ — Каталог";
            if (np.includes("/add-store")) return "Админ — Филиал/Дўкон қўшиш";
            if (np.includes("/summary")) return "Админ — Umumiy hisobot";
            return "Админ";
        }
        if (np === "/report") return "Hisobot";
        if (np === "/sales") return "Сотиш";
        if (np === "/returns") return "Қайтариш";
        if (np === "/monitoring") return "Monitoring";
        // Default nom
        const defaultStoreName =
            stores.find((x) => x.id === currentStoreId)?.name ?? "Рукшона — Меню";
        return defaultStoreName;
    }, [np, stores, currentStoreId]);

    // Top (Header + NetBanner) balandligi
    const [topH, setTopH] = useState<number>(56 + (Platform.OS === "android" ? 8 : 0) + 32);

    // Progress: 0 -> yopiq, 1 -> ochiq
    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(progress, {
            toValue: menuOpen ? 1 : 0,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [menuOpen]);

    // Header + NetBanner vertikal surish
    const translateY = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -topH],
    });

    // Backdrop opacity
    const backdropOpacity = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });

    // Drawer chapdan kirish
    const drawerTX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [-DRAWER_W, 0],
    });

    // Backdrop yuqori chegarasi
    const overlayTop = menuOpen ? 0 : topH;

    return (
        <View style={styles.root}>
            {/* Top (Header + Banner) */}
            <Animated.View
                style={{ transform: [{ translateY }] }}
                onLayout={(e) => setTopH(Math.ceil(e.nativeEvent.layout.height))}
            >
                <SafeAreaView edges={["top"]} style={{ backgroundColor: "#fff" }}>
                    <View style={[styles.header, Platform.OS === "android" && { paddingTop: 8 }]}>
                        <TouchableOpacity
                            onPress={() => setMenu(!menuOpen)}
                            style={styles.iconBtn}
                            accessibilityLabel="Меню"
                        >
                            <Ionicons name="menu" size={24} />
                        </TouchableOpacity>

                        <Text style={styles.headerTitle}>{headerTitle}</Text>
                        <View style={{ flex: 1 }} />
                    </View>

                    {/* FAQAT 4 sahifada StorePicker */}
                    {PICKER_PATHS.has(np) && (
                        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
                            <StorePicker compact />
                        </View>
                    )}
                </SafeAreaView>

                {/* Online/Offline Banner */}
                <NetBanner />
            </Animated.View>

            {/* Content */}
            <View style={{ flex: 1 }}>
                <Slot />
            </View>

            {/* Backdrop (fade) */}
            <Animated.View
                pointerEvents={menuOpen ? "auto" : "none"}
                style={[styles.backdrop, { top: overlayTop, opacity: backdropOpacity }]}
            >
                <Pressable style={{ flex: 1 }} onPress={() => setMenu(false)} />
            </Animated.View>

            {/* Left Drawer (slide-in) */}
            <Animated.View
                style={[
                    styles.drawer,
                    { top: overlayTop, width: DRAWER_W, transform: [{ translateX: drawerTX }] },
                ]}
            >
                <LeftMenu onClose={() => setMenu(false)} />
            </Animated.View>
        </View>
    );
}

function LeftMenu({ onClose }: { onClose: () => void }) {
    const go = (href: Href) => {
        onClose();
        router.push(href);
    };

    const goAdmin = (
        href:
            | "/(main)/admin/add-store"
            | "/(main)/admin/catalog"
            | "/(main)/admin/summary"
    ) => {
        onClose();
        router.push(href);
    };

    const goExpenses = () => {
        onClose();
        router.push("/(main)/expenses" as Href);
    };

    const logout = async () => {
        onClose();
        await signOutLocal();
        router.replace("/(auth)/login");
    };

    return (
        <View style={styles.drawerInner}>
            <Text style={styles.sectionTitleRed}>Асосий</Text>

            <TouchableOpacity onPress={() => go("/(main)/report" as Href)} style={styles.adminItem}>
                <Ionicons name="stats-chart" size={18} color="#333" />
                <Text style={styles.adminText}>Hisobot</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => go("/(main)/sales" as Href)} style={styles.adminItem}>
                <Ionicons name="cart" size={18} color="#333" />
                <Text style={styles.adminText}>Сотиш</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => go("/(main)/returns" as Href)} style={styles.adminItem}>
                <Ionicons name="refresh" size={18} color="#333" />
                <Text style={styles.adminText}>Қайтариш</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => go("/(main)/monitoring" as Href)} style={styles.adminItem}>
                <Ionicons name="pulse" size={18} color="#333" />
                <Text style={styles.adminText}>Monitoring</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            <Text style={styles.sectionTitle}>Админ</Text>
            <TouchableOpacity onPress={() => goAdmin("/(main)/admin/add-store")} style={styles.adminItem}>
                <Ionicons name="business" size={18} color="#333" />
                <Text style={styles.adminText}>Филиал/Дўкон қўшиш</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => goAdmin("/(main)/admin/catalog")} style={styles.adminItem}>
                <Ionicons name="albums" size={18} color="#333" />
                <Text style={styles.adminText}>Каталог</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => goAdmin("/(main)/admin/summary")} style={styles.adminItem}>
                <Ionicons name="stats-chart" size={18} color="#333" />
                <Text style={styles.adminText}>Umumiy Hisobot</Text>
            </TouchableOpacity>

            <View style={styles.separator} />
            <Text style={styles.sectionTitle}>Moliya</Text>
            <TouchableOpacity onPress={goExpenses} style={styles.adminItem}>
                <Ionicons name="cash-outline" size={18} color="#333" />
                <Text style={styles.adminText}>Xarajatlar</Text>
            </TouchableOpacity>

            <View style={{ height: 8 }} />
            <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
                <Ionicons name="log-out-outline" size={18} color="#770E13" />
                <Text style={styles.logoutText}>Чиқиш</Text>
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: "#fafafa" },

    header: {
        minHeight: 56,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 12,
        backgroundColor: "#fff",
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    iconBtn: { padding: 8 },
    headerTitle: { marginLeft: 12, fontSize: 18, fontWeight: "700" },

    backdrop: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.18)",
    },

    drawer: {
        position: "absolute",
        left: 0,
        bottom: 0,
        backgroundColor: "#fff",
        borderRightWidth: 1,
        borderColor: "#eee",
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },

    drawerInner: { padding: 14 },

    sectionTitleRed: { fontWeight: "800", color: "#770E13", marginBottom: 6 },
    sectionTitle: { fontWeight: "800", color: "#222", marginTop: 4, marginBottom: 6 },

    separator: { height: 10, borderBottomWidth: 1, borderColor: "#f0f0f0", marginVertical: 6 },

    adminItem: { paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
    adminText: { color: "#222", fontSize: 15 },

    logoutBtn: {
        paddingVertical: 12,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
        borderWidth: 1,
        borderColor: "#F4C7CB",
        backgroundColor: "#FCE9EA",
        borderRadius: 10,
        marginTop: 6,
    },
    logoutText: { color: "#770E13", fontWeight: "800", fontSize: 15, marginLeft: 2 },
});
