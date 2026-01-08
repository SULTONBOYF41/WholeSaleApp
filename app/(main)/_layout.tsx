// app/(main)/_layout.tsx
import NetBanner from "@/components/NetBanner";
import StorePicker from "@/components/StorePicker";
import { signOutLocal } from "@/lib/local-auth";
import { useAppStore } from "@/store/appStore";
import "@/store/appStore.fix";
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
    const toggleMenu = useAppStore((s) => s.toggleMenu);

    const currentStoreId = useAppStore((s) => s.currentStoreId);
    const stores = useAppStore((s) => s.stores);

    const pathname = usePathname();
    const np = normalize(pathname);

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

        const def = stores.find((x) => String(x.id) === String(currentStoreId))?.name ?? "Рукшона — Меню";
        return def;
    }, [np, stores, currentStoreId]);

    const [topH, setTopH] = useState<number>(56 + (Platform.OS === "android" ? 8 : 0) + 32);

    const progress = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(progress, {
            toValue: menuOpen ? 1 : 0,
            duration: 260,
            easing: Easing.out(Easing.cubic),
            useNativeDriver: true,
        }).start();
    }, [menuOpen, progress]);

    const translateY = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, -topH],
    });

    const backdropOpacity = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0, 1],
    });

    const drawerTX = progress.interpolate({
        inputRange: [0, 1],
        outputRange: [-DRAWER_W, 0],
    });

    const overlayTop = menuOpen ? 0 : topH;

    const onToggleMenu = () => {
        // ✅ 100% safe: ikkalasi ham bor
        if (typeof toggleMenu === "function") toggleMenu();
        else setMenu(!menuOpen);
    };

    return (
        <View style={styles.root}>
            {/* Top (Header + Banner) */}
            <Animated.View
                style={{ transform: [{ translateY }] }}
                onLayout={(e) => setTopH(Math.ceil(e.nativeEvent.layout.height))}
            >
                <SafeAreaView edges={["top"]} style={{ backgroundColor: "#fff" }}>
                    <View style={[styles.header, Platform.OS === "android" && { paddingTop: 8 }]}>
                        <TouchableOpacity onPress={onToggleMenu} style={styles.iconBtn} accessibilityLabel="Меню">
                            <Ionicons name="menu" size={24} />
                        </TouchableOpacity>

                        <Text style={styles.headerTitle} numberOfLines={1}>
                            {headerTitle}
                        </Text>

                        <View style={{ flex: 1 }} />
                    </View>

                    {PICKER_PATHS.has(np) && (
                        <View style={{ paddingHorizontal: 12, paddingBottom: 8 }}>
                            <StorePicker compact />
                        </View>
                    )}
                </SafeAreaView>

                <NetBanner />
            </Animated.View>

            {/* Content */}
            <View style={{ flex: 1 }}>
                <Slot />
            </View>

            {/* Backdrop */}
            <Animated.View
                pointerEvents={menuOpen ? "auto" : "none"}
                style={[styles.backdrop, { top: overlayTop, opacity: backdropOpacity }]}
            >
                <Pressable style={{ flex: 1 }} onPress={() => setMenu(false)} />
            </Animated.View>

            {/* Drawer */}
            <Animated.View
                style={[styles.drawer, { top: overlayTop, width: DRAWER_W, transform: [{ translateX: drawerTX }] }]}
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
        href: "/(main)/admin/add-store" | "/(main)/admin/catalog" | "/(main)/admin/summary"
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

            <TouchableOpacity onPress={() => go("/(main)/report" as Href)} style={styles.item}>
                <Ionicons name="stats-chart" size={18} color="#333" />
                <Text style={styles.text}>Hisobot</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => go("/(main)/sales" as Href)} style={styles.item}>
                <Ionicons name="cart" size={18} color="#333" />
                <Text style={styles.text}>Сотиш</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => go("/(main)/returns" as Href)} style={styles.item}>
                <Ionicons name="refresh" size={18} color="#333" />
                <Text style={styles.text}>Қайтариш</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => go("/(main)/monitoring" as Href)} style={styles.item}>
                <Ionicons name="pulse" size={18} color="#333" />
                <Text style={styles.text}>Monitoring</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            <Text style={styles.sectionTitle}>Админ</Text>

            <TouchableOpacity onPress={() => goAdmin("/(main)/admin/add-store")} style={styles.item}>
                <Ionicons name="business" size={18} color="#333" />
                <Text style={styles.text}>Филиал/Дўкон қўшиш</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => goAdmin("/(main)/admin/catalog")} style={styles.item}>
                <Ionicons name="albums" size={18} color="#333" />
                <Text style={styles.text}>Каталог</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => goAdmin("/(main)/admin/summary")} style={styles.item}>
                <Ionicons name="stats-chart" size={18} color="#333" />
                <Text style={styles.text}>Umumiy Hisobot</Text>
            </TouchableOpacity>

            <View style={styles.separator} />

            <Text style={styles.sectionTitle}>Moliya</Text>
            <TouchableOpacity onPress={goExpenses} style={styles.item}>
                <Ionicons name="cash-outline" size={18} color="#333" />
                <Text style={styles.text}>Xarajatlar</Text>
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
    headerTitle: { marginLeft: 12, fontSize: 18, fontWeight: "700", flexShrink: 1 },

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

    item: { paddingVertical: 10, flexDirection: "row", alignItems: "center", gap: 8 },
    text: { color: "#222", fontSize: 15 },

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
