// app/(main)/expenses/_layout.tsx
import { useExpensesStore } from "@/store/expensesStore";
import { Ionicons } from "@expo/vector-icons";
import type { Href } from "expo-router";
import { router, Stack, usePathname } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";


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

const isActive = (path: string | null | undefined, href: string) => {
    if (!path) return false;
    if (path === href) return true;
    if (path.startsWith(href + "/")) return true;
    if (path.startsWith(href + "?")) return true;
    return false;
};

export default function ExpensesLayout() {
    const pathname = usePathname();

    const { fetchAll } = useExpensesStore();
    useEffect(() => {
        fetchAll();               // ilova ochilganda xarajatlarni tortib keladi
    }, []);
    return (
        <View style={{ flex: 1 }}>
            <Stack screenOptions={{ headerShown: false }} />
            <View style={styles.bar}>
                {TABS.map((t) => {
                    const active = isActive(pathname, t.href as string);
                    const go = () => { if (!active) router.replace(t.href); };
                    return (
                        <TouchableOpacity key={t.href as string} onPress={go} style={styles.tab} accessibilityRole="tab" accessibilityState={{ selected: active }}>
                            <Ionicons name={t.icon} size={20} color={active ? "#770E13" : "#555"} />
                            <Text style={[styles.tabText, active && styles.activeText]}>{t.name}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    bar: { height: 62, borderTopWidth: 1, borderTopColor: "#eee", backgroundColor: "#fff", flexDirection: "row" },
    tab: { flex: 1, alignItems: "center", justifyContent: "center", gap: 2 },
    tabText: { fontSize: 12, color: "#333" },
    activeText: { color: "#770E13", fontWeight: "700" },
});
