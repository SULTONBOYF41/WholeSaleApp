// app/(main)/expenses/_layout.tsx
import { useExpensesStore } from "@/store/expensesStore";
import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { router, Stack, usePathname } from "expo-router";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const PRIMARY = "#770E13";

type TabItem = {
    name: string;
    icon: keyof typeof Ionicons.glyphMap;
    href: Href;
};

const TABS: TabItem[] = [
    { name: "Hisobot", icon: "stats-chart-outline", href: "/(main)/expenses/report" as Href },
    { name: "Oilaviy", icon: "people-outline", href: "/(main)/expenses/family" as Href },
    { name: "Do'kon", icon: "business-outline", href: "/(main)/expenses/shop" as Href },
    { name: "Bank", icon: "card-outline", href: "/(main)/expenses/bank" as Href },
];

/** /(group) segmentlarni olib tashlaydi va trailing slashni tozalaydi */
const normalize = (p?: string | null): string => {
    if (!p) return "/";
    // /(main) kabi group segmentlarni olib tashlash
    let s = p.replace(/\/\([^/]+\)/g, "");
    // trailing slashni olib tashlash (rootdan tashqari)
    if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
    return s;
};

const isActive = (path: string | null | undefined, href: string) => {
    const P = normalize(path);
    const H = normalize(href);
    if (P === H) return true;
    // nested yoki query holatlari
    if (P.startsWith(H + "/")) return true;
    if (P.startsWith(H + "?")) return true;
    return false;
};

export default function ExpensesLayout() {
    const pathname = usePathname();

    // Bir marta ma'lumotlarni tortib kelamiz
    const { fetchAll } = useExpensesStore();
    useEffect(() => { fetchAll(); }, []);

    return (
        <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }} />
            <SafeAreaView edges={["bottom"]} style={styles.safe}>
                <View style={styles.bar}>
                    {TABS.map((t) => {
                        const href = t.href as string;
                        const active = isActive(pathname, href);
                        const color = active ? PRIMARY : "#555";
                        const go = () => { if (!active) router.replace(t.href); };

                        return (
                            <TouchableOpacity
                                key={href}
                                onPress={go}
                                style={styles.tab}
                                accessibilityRole="tab"
                                accessibilityState={{ selected: active }}
                                hitSlop={{ top: 8, bottom: 8, left: 12, right: 12 }}
                            >
                                <View style={styles.tabInner}>
                                    <Ionicons name={t.icon} size={20} color={color} style={styles.icon} />
                                    <Text style={[styles.tabText, active && styles.activeText]}>{t.name}</Text>
                                </View>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    safe: { backgroundColor: "#fff" },
    bar: {
        height: 80,
        borderTopWidth: 1,
        borderTopColor: "#eee",
        backgroundColor: "#fff",
        flexDirection: "row",
    },
    tab: { flex: 1, alignItems: "center", justifyContent: "center" },
    // Ikon+matnni biroz tepaga ko'taramiz
    tabInner: { alignItems: "center", justifyContent: "center", gap: 2, transform: [{ translateY: -12 }] },
    icon: { marginBottom: 1 },
    tabText: { fontSize: 12, color: "#333" },
    activeText: { color: PRIMARY, fontWeight: "700" },
});
