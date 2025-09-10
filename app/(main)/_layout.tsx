// app/(main)/_layout.tsx
import NetBanner from "@/components/NetBanner";
import { signOutLocal } from "@/lib/local-auth";
import { useAppStore } from "@/store/appStore";
import { Ionicons } from "@expo/vector-icons";
import { Slot, router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { Animated, Dimensions, Easing, Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { width: SCREEN_W } = Dimensions.get("window");
const DRAWER_W = Math.min(300, Math.floor(SCREEN_W * 0.86));

export default function MainLayout() {
    const menuOpen = useAppStore((s) => s.menuOpen);
    const setMenu = useAppStore((s) => s.setMenu);
    const currentStoreId = useAppStore((s) => s.currentStoreId);
    const stores = useAppStore((s) => s.stores);

    const currentStoreName = stores.find((x) => x.id === currentStoreId)?.name ?? "Рукшона — Меню";

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

    // Backdrop yuqori chegarasi (menyu ochiq paytda to'liq ekranga yoyilsin)
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

                        <Text style={styles.headerTitle}>{currentStoreName}</Text>
                        <View style={{ flex: 1 }} />
                    </View>
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
                style={[
                    styles.backdrop,
                    { top: overlayTop, opacity: backdropOpacity },
                ]}
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
                <LeftMenu
                    onClose={() => setMenu(false)}
                />
            </Animated.View>
        </View>
    );
}

function LeftMenu({ onClose }: { onClose: () => void }) {
    const stores = useAppStore((s) => s.stores);
    const setCurrentStore = useAppStore((s) => s.setCurrentStore);

    const branches = stores.filter((s) => s.type === "branch");
    const markets = stores.filter((s) => s.type === "market");

    const goStore = (id: string) => {
        onClose();
        setCurrentStore(id);
        router.push({ pathname: "/(main)/store/[id]/dashboard", params: { id } });
    };

    const goAdmin = (href: "/(main)/admin/add-store" | "/(main)/admin/catalog") => {
        onClose();
        router.push(href);
    };

    const logout = async () => {
        onClose();
        await signOutLocal();
        router.replace("/(auth)/login");
    };

    return (
        <View style={styles.drawerInner}>
            <Text style={styles.sectionTitleRed}>Филиаллар</Text>
            {branches.length === 0 && <Text style={styles.emptyHint}>Ҳали филиал қўшилмаган</Text>}
            {branches.map((b) => (
                <TouchableOpacity key={b.id} onPress={() => goStore(b.id)} style={styles.drawerItem}>
                    <Text style={styles.drawerText}>{b.name}</Text>
                </TouchableOpacity>
            ))}

            <View style={styles.separator} />

            <Text style={styles.sectionTitleRed}>Дўкон/Супермаркетлар</Text>
            {markets.length === 0 && <Text style={styles.emptyHint}>Ҳали дўкон қўшилмаган</Text>}
            {markets.map((m) => (
                <TouchableOpacity key={m.id} onPress={() => goStore(m.id)} style={styles.drawerItem}>
                    <Text style={styles.drawerText}>{m.name}</Text>
                </TouchableOpacity>
            ))}

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
        // soyalar
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 8,
        shadowOffset: { width: 0, height: 4 },
        elevation: 6,
    },

    drawerInner: {
        padding: 14,
    },

    sectionTitleRed: { fontWeight: "800", color: "#770E13", marginBottom: 6 },
    sectionTitle: { fontWeight: "800", color: "#222", marginTop: 4, marginBottom: 6 },

    emptyHint: { color: "#888", marginBottom: 6 },

    drawerItem: { paddingVertical: 10 },
    drawerText: { color: "#222", fontSize: 15 },

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
