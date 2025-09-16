// app/(main)/store/[id]/_layout.tsx
import { C } from "@/components/UI";
import { Ionicons } from "@expo/vector-icons";
import { Slot, useLocalSearchParams, usePathname, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type TabDef = {
    key: "dashboard" | "sales" | "returns" | "history";
    label: string;
    icon: keyof typeof Ionicons.glyphMap;
    href: (id: string) => string;
};

export default function StoreLayout() {
    const { id } = useLocalSearchParams<{ id?: string }>();
    const sid = String(id ?? "");
    const pathname = usePathname();
    const router = useRouter();

    // Hreflarni funksiya bilan quramiz (router.push safe)
    const tabs: TabDef[] = useMemo(
        () => [
            {
                key: "dashboard",
                label: "Hisobot",
                icon: "speedometer-outline",
                href: (id) => `/(main)/store/${id}/dashboard`,
            },
            {
                key: "sales",
                label: "Sotuv",
                icon: "cart-outline",
                href: (id) => `/(main)/store/${id}/sales`,
            },
            {
                key: "returns",
                label: "Vazvrat",
                icon: "return-down-back-outline",
                href: (id) => `/(main)/store/${id}/returns`,
            },
            {
                key: "history",
                label: "Monitoring",
                icon: "time-outline",
                href: (id) => `/(main)/store/${id}/history`,
            },
        ],
        []
    );

    const isActive = (href: string) => !!pathname && pathname.startsWith(href);

    const go = (href: string) => {
        // id bo'lmasa, hech narsa qilmaymiz
        if (!sid) return;
        // Shundoq shu route bo'lsa, push qilmaymiz
        if (pathname === href) return;
        router.push(href as any);
    };

    return (
        <View style={styles.root}>
            {/* Kontent (pastki tablar uchun joy qoldiramiz) */}
            <View style={{ flex: 1, paddingBottom: 72 }}>
                <Slot />
            </View>

            {/* Bottom Tabs */}
            <SafeAreaView edges={["bottom"]} style={{ backgroundColor: "#fff" }}>
                <View style={styles.tabBar}>
                    {tabs.map((t) => {
                        const href = t.href(sid);
                        const active = isActive(href);
                        const disabled = !sid;

                        return (
                            <TouchableOpacity
                                key={t.key}
                                onPress={() => go(href)}
                                disabled={disabled}
                                accessibilityRole="button"
                                style={[
                                    styles.tabItem,
                                    active && styles.tabItemActive,
                                    disabled && { opacity: 0.5 },
                                ]}
                                activeOpacity={0.8}
                            >
                                <Ionicons
                                    name={t.icon}
                                    size={20}
                                    color={active ? C.primary : "#6B7280"}
                                />
                                {/* MUHIM: Matn doim <Text> ichida */}
                                <Text
                                    style={[
                                        styles.tabLabel,
                                        { color: active ? C.primary : "#6B7280" },
                                    ]}
                                    numberOfLines={1}
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
