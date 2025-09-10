// app/(main)/store/[id]/_layout.tsx
import { C } from "@/components/UI";
import { Ionicons } from "@expo/vector-icons";
import { Slot, router, useLocalSearchParams, usePathname } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function StoreLayout() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const sid = String(id ?? "");
    const pathname = usePathname();

    // Hreflarni funksiya bilan quramiz (replace o‘rniga)
    const tabs = useMemo(
        () => [
            {
                key: "dashboard",
                label: "Hisobot",
                icon: "speedometer-outline" as const,
                href: (id: string) => `/(main)/store/${id}/dashboard`,
            },
            {
                key: "sales",
                label: "Sotuv",
                icon: "cart-outline" as const,
                href: (id: string) => `/(main)/store/${id}/sales`,
            },
            {
                key: "returns",
                label: "Vazvrat",
                icon: "return-down-back-outline" as const,
                href: (id: string) => `/(main)/store/${id}/returns`,
            },
            {
                key: "history",
                label: "Monitoring",
                icon: "time-outline" as const,
                href: (id: string) => `/(main)/store/${id}/history`,
            },
        ],
        []
    );

    const isActive = (href: string) => Boolean(pathname?.startsWith(href));

    // TypeScript Href literal talabini chetlab o‘tamiz (custom tabbar uchun normal)
    const go = (href: string) => router.push(href as any);

    return (
        <View style={styles.root}>
            {/* Content, pastki tablar uchun bo'sh joy */}
            <View style={{ flex: 1, paddingBottom: 72 }}>
                <Slot />
            </View>

            {/* Bottom Tabs */}
            <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "#fff" }}>
                <View style={styles.tabBar}>
                    {tabs.map((t) => {
                        const href = t.href(sid);
                        const active = isActive(href);
                        return (
                            <TouchableOpacity
                                key={t.key}
                                onPress={() => go(href)}
                                style={[styles.tabItem, active && styles.tabItemActive]}
                            >
                                <Ionicons
                                    name={t.icon}
                                    size={20}
                                    color={active ? C.primary : "#6B7280"}
                                />
                                <Text
                                    style={[
                                        styles.tabLabel,
                                        { color: active ? C.primary : "#6B7280" },
                                    ]}
                                >
                                    {t.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>
            </SafeAreaView>
        </View>
    );
}

const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: C.bg },
    tabBar: {
        flexDirection: "row",
        borderTopWidth: 1,
        borderTopColor: "#eee",
        backgroundColor: "#fff",
        paddingVertical: 8,
        paddingHorizontal: 6,
    },
    tabItem: {
        flex: 1,
        alignItems: "center",
        gap: 4,
        paddingVertical: 6,
        borderRadius: 10,
    },
    tabItemActive: {
        backgroundColor: C.primarySoft,
    },
    tabLabel: {
        fontSize: 12,
        fontWeight: "800",
    },
});
