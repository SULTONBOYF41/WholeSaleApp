import { Button, C, Card, Chip, H1, H2, Input } from "@/components/UI";
import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import type { Store, StoreType } from "@/types";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, SectionList, Text, TouchableOpacity, View } from "react-native";

export default function AddStore() {
    const categories = useAppStore((s) => s.categories);
    const stores = useAppStore((s) => s.stores);
    const upsertStore = useAppStore((s) => s.upsertStore);
    const removeStore = useAppStore((s) => s.removeStore);

    // ⬇️ online status (auto push/pull ni boshqaramiz)
    const online = useSyncStore((s) => s.online);

    const [name, setName] = useState("");
    const [type, setType] = useState<StoreType>("branch");
    const [prices, setPrices] = useState<Record<string, string>>({});
    const [editing, setEditing] = useState<Store | null>(null);

    const branches = stores.filter((s) => s.type === "branch");
    const markets = stores.filter((s) => s.type === "market");

    const sections = useMemo(
        () => [
            { title: "Филиаллар", data: branches },
            { title: "Дўконлар", data: markets },
        ],
        [branches, markets]
    );

    const changePrice = (catId: string, v: string) =>
        setPrices((p) => ({ ...p, [catId]: v }));

    const resetForm = () => {
        setName("");
        setType("branch");
        setPrices({});
        setEditing(null);
    };

    const submit = async () => {
        if (!name.trim()) return;

        const pp: Record<string, number> = {};
        Object.entries(prices).forEach(([k, v]) => {
            if (v) pp[k] = +v;
        });

        await upsertStore({ id: editing?.id, name: name.trim(), type, prices: pp });

        // ⬇️ Online bo'lsa — zudlik bilan push/pull (boshqa qurilmalarda ham realtime ko'rinsin)
        if (online) {
            try {
                await useAppStore.getState().pushNow();
            } catch { }
            try {
                await useAppStore.getState().pullNow();
            } catch { }
        }

        resetForm();
    };

    const startEdit = (s: Store) => {
        setEditing(s);
        setName(s.name);
        setType(s.type);
        const p: Record<string, string> = {};
        Object.entries(s.prices || {}).forEach(([k, v]) => {
            p[k] = String(v);
        });
        setPrices(p);
    };

    const confirmRemove = (id: string) => {
        Alert.alert("Олиб ташлаш", "Ростдан ҳам ўчирилсинми?", [
            { text: "Бекор" },
            {
                text: "Ҳа",
                style: "destructive",
                onPress: async () => {
                    await removeStore(id);

                    // ⬇️ Online bo'lsa — darhol Supabase'ga delete yuboramiz, keyin pull
                    if (online) {
                        try {
                            await useAppStore.getState().pushNow();
                        } catch { }
                        try {
                            await useAppStore.getState().pullNow();
                        } catch { }
                    }
                },
            },
        ]);
    };

    // (ixtiyoriy) bu sahifa ochilganda realtime pull yoqilganini kafolatlash
    useEffect(() => {
        useAppStore.getState().startPull().catch(() => { });
    }, []);

    const ListHeader = useMemo(
        () => (
            <View style={{ padding: 16, paddingBottom: 0, gap: 10 }}>
                <H1>Филиал/Дўкон қўшиш</H1>

                <H2>Номи</H2>
                <Input value={name} onChangeText={setName} placeholder="" />

                <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                    <TouchableOpacity onPress={() => setType("branch")} style={{ flex: 1 }}>
                        <Chip active={type === "branch"} label="Филиал" style={{ alignItems: "center" }} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setType("market")} style={{ flex: 1 }}>
                        <Chip active={type === "market"} label="Дўкон" style={{ alignItems: "center" }} />
                    </TouchableOpacity>
                </View>

                <H2>Категориялар ва нарх (сўм)</H2>
                {categories.length === 0 && (
                    <Text style={{ color: C.muted }}>
                        Категориялар ҳали йўқ — аввало “Каталог”дан қўшинг.
                    </Text>
                )}
                {categories.map((c) => (
                    <View
                        key={c.id}
                        style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}
                    >
                        <Text style={{ width: 140 }}>{c.name}</Text>
                        <Input
                            value={prices[c.id] ?? ""}
                            onChangeText={(v: string) => changePrice(c.id, v)}
                            keyboardType="numeric"
                            style={{ flex: 1 }}
                        />
                    </View>
                ))}

                <Button onPress={submit} title={editing ? "Сақлаш" : "Қўшиш"} />

                <H2 style={{ marginTop: 8 }}>Жорий рўйхат</H2>
            </View>
        ),
        [name, type, prices, categories.length, editing]
    );

    return (
        <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            stickySectionHeadersEnabled
            ListHeaderComponent={ListHeader}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            renderSectionHeader={({ section }) => (
                <View style={{ backgroundColor: C.bg, paddingVertical: 8 }}>
                    <Text style={{ fontWeight: "800", color: C.text }}>{section.title}</Text>
                </View>
            )}
            renderItem={({ item }) => (
                <Card style={{ marginTop: 8 }}>
                    <Text style={{ fontWeight: "800", color: C.text }}>{item.name}</Text>
                    <Text style={{ color: C.muted }}>{item.type === "branch" ? "Филиал" : "Дўкон"}</Text>
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 8 }}>
                        <Button onPress={() => startEdit(item)} title="Таҳрирлаш" tone="neutral" />
                        <Button onPress={() => confirmRemove(item.id)} title="Ўчириш" tone="danger" />
                    </View>
                </Card>
            )}
        />
    );
}
