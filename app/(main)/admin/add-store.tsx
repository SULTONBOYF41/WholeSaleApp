// app/(main)/admin/add-store.tsx
import Toast from "@/components/Toast";
import { Button, C, Card, Chip, H1, H2, Input } from "@/components/UI";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import { useToastStore } from "@/store/toastStore"; // ← YANGI
import type { Store, StoreType } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, SectionList, Text, TouchableOpacity, View } from "react-native";

export default function AddStore() {
    const categories = useAppStore((s) => s.categories);
    const stores = useAppStore((s) => s.stores);
    const upsertStore = useAppStore((s) => s.upsertStore);
    const removeStore = useAppStore((s) => s.removeStore);

    const online = useSyncStore((s) => s.online);
    const toast = useToastStore();

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

        // ← POPUP (faqat 2 xabar)
        if (online) toast.showLoading("Saqlanmoqda…");
        else toast.showLoading("Offline: navbatga yozildi");


        const pp: Record<string, number> = {};
        Object.entries(prices).forEach(([k, v]) => {
            if (v) pp[k] = +v;
        });

        await upsertStore({ id: editing?.id, name: name.trim(), type, prices: pp });

        if (online) {
            try { await useAppStore.getState().pushNow(); } catch { }
            try { await useAppStore.getState().pullNow(); } catch { }
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
                    // ← POPUP (faqat 2 xabar)
                    if (online) toast.show("Saqlanmoqda…");
                    else toast.show("Offline: navbatga yozildi");

                    await removeStore(id);
                    if (online) {
                        try { await useAppStore.getState().pushNow(); } catch { }
                        try { await useAppStore.getState().pullNow(); } catch { }
                    }
                },
            },
        ]);
    };

    // --- Realtime + polling (o‘zgartirmadik) ---
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        useAppStore.getState().startPull().catch(() => { });
        useAppStore.getState().pullNow().catch(() => { });

        const chStores = supabase
            .channel("rt-stores")
            .on("postgres_changes", { event: "*", schema: "public", table: "stores" }, () =>
                useAppStore.getState().pullNow().catch(() => { })
            )
            .subscribe();

        const chProducts = supabase
            .channel("rt-products-for-add-store")
            .on("postgres_changes", { event: "*", schema: "public", table: "products" }, () =>
                useAppStore.getState().pullNow().catch(() => { })
            )
            .subscribe();

        pollRef.current = setInterval(() => {
            useAppStore.getState().pullNow().catch(() => { });
        }, 15000);

        return () => {
            if (pollRef.current !== null) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
            supabase.removeChannel(chStores);
            supabase.removeChannel(chProducts);
        };
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
        <>
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
                    <Card style={{ marginTop: 8, padding: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            {/* chap: nom + turi */}
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={{ fontWeight: "800", color: C.text }}>{item.name}</Text>
                                <Text style={{ color: C.muted }}>
                                    {item.type === "branch" ? "Филиал" : "Дўкон"}
                                </Text>
                            </View>

                            {/* o‘ng: ikon tugmalar (edit / delete) */}
                            <View style={{ flexDirection: "row", gap: 10 }}>
                                <TouchableOpacity
                                    onPress={() => startEdit(item)}
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 20,
                                        backgroundColor: "#fff",
                                        borderWidth: 1,
                                        borderColor: "#E9ECF1",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                    accessibilityLabel="Таҳрирлаш"
                                >
                                    <Ionicons name="create-outline" size={20} color="#770E13" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => confirmRemove(item.id)}
                                    style={{
                                        width: 40,
                                        height: 40,
                                        borderRadius: 20,
                                        backgroundColor: "#FCE9EA",
                                        borderWidth: 1,
                                        borderColor: "#F4C7CB",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                    accessibilityLabel="Ўчириш"
                                >
                                    <Ionicons name="close-outline" size={20} color="#E23D3D" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Card>
                )}
            />
            <Toast />
        </>
    );
}
