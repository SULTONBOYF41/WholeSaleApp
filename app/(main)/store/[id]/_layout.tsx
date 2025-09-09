import { Slot, router, useLocalSearchParams, usePathname } from "expo-router";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const BAR_H = 70;
const MARGIN_BOTTOM = Platform.select({ ios: 10, android: 10 }) as number;
type Slug = "dashboard" | "sales" | "returns" | "history";

const tabs: { label: string; slug: Slug }[] = [
    { label: "Ҳисоботлар", slug: "dashboard" },
    { label: "Сотиш", slug: "sales" },
    { label: "Қайтариш", slug: "returns" },
    { label: "Тарих", slug: "history" },
];

export default function StoreLayout() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const pathname = usePathname();
    const { bottom } = useSafeAreaInsets();
    const go = (slug: Slug) => router.replace(`/(main)/store/${id}/${slug}`);

    return (
        <View style={{ flex: 1 }}>
            <Slot />
            <View style={{
                position: "absolute", left: 16, right: 16, bottom: (bottom || 8) + MARGIN_BOTTOM, height: BAR_H,
                backgroundColor: "#fff", borderRadius: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                paddingHorizontal: 10, elevation: 10, shadowColor: "#000", shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }
            }}>
                {tabs.map(t => {
                    const active = pathname.endsWith(`/${t.slug}`);
                    return (
                        <TouchableOpacity key={t.slug} onPress={() => go(t.slug)}
                            style={{ flex: 1, alignItems: "center", paddingVertical: 12, borderRadius: 12, backgroundColor: active ? "#F6EAD4" : "transparent" }}>
                            <Text style={{ fontSize: 12, fontWeight: active ? "800" : "600", color: active ? "#770E13" : "#222" }}>{t.label}</Text>
                        </TouchableOpacity>
                    );
                })}
            </View>
        </View>
    );
}
