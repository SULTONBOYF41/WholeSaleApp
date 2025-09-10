// app/(main)/_layout.tsx
import NetBanner from "@/components/NetBanner";
import { signOutLocal } from "@/lib/local-auth";
import { useAppStore } from "@/store/appStore";
import { Ionicons } from "@expo/vector-icons";
import { Slot, router } from "expo-router";
import React from "react";
import { Platform, Pressable, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function MainLayout() {
    const menuOpen = useAppStore((s) => s.menuOpen);
    const setMenu = useAppStore((s) => s.setMenu);
    const currentStoreId = useAppStore((s) => s.currentStoreId);
    const stores = useAppStore((s) => s.stores);

    const currentStoreName =
        stores.find((x) => x.id === currentStoreId)?.name ?? "Рукшона — Меню";

    return (
        <View style={styles.root}>
            {/* Header */}
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

            {/* Content */}
            <Slot />

            {/* Left Drawer + backdrop */}
            {menuOpen && (
                <>
                    <Pressable style={styles.backdrop} onPress={() => setMenu(false)} />
                    <LeftMenu onClose={() => setMenu(false)} />
                </>
            )}
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
        <View style={styles.drawer}>
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
        top: 56 + (Platform.OS === "android" ? 8 : 0),
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0,0,0,0.15)",
    },

    drawer: {
        position: "absolute",
        left: 0,
        top: 56 + (Platform.OS === "android" ? 8 : 0),
        bottom: 0,
        width: 300,
        backgroundColor: "#fff",
        borderRightWidth: 1,
        borderColor: "#eee",
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
