import Toast from "@/components/Toast";
import { getStorePrice } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import { useToastStore } from "@/store/toastStore";
import type { Product, Unit } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams } from "expo-router";
import React, { useCallback, useMemo, useRef, useState } from "react";

import {
    FlatList,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type Row = { key: string; product?: Product; qty: string; price: string; unit: Unit };

export default function Returns() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const addReturn = useAppStore((s) => s.addReturn);
    const products = useAppStore((s) => s.products);
    const stores = useAppStore((s) => s.stores);
    const online = useSyncStore((s) => s.online);
    const toast = useToastStore();

    const store = stores.find((s) => s.id === id);

    const [rows, setRows] = useState<Row[]>([{ key: "r1", qty: "", price: "", unit: "дона" }]);
    const [pickOpenFor, setPickOpenFor] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const channelRef = useRef<any>(null);

    const startPolling = useCallback(() => {
        if (pollRef.current) return;
        pollRef.current = setInterval(() => {
            useAppStore.getState().pullNow().catch(() => { });
        }, 8000);
    }, []);

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    const subscribeRealtime = useCallback(() => {
        if (channelRef.current) {
            try {
                supabase.removeChannel(channelRef.current);
            } catch { }
            channelRef.current = null;
        }
        const ch = supabase
            .channel("returns-live")
            .on("postgres_changes", { event: "*", schema: "public", table: "returns" }, () => {
                useAppStore.getState().pullNow().catch(() => { });
            })
            .subscribe();
        channelRef.current = ch;
    }, []);

    useFocusEffect(
        React.useCallback(() => {
            useAppStore.getState().startPull().catch(() => { });
            subscribeRealtime();
            if (online) startPolling();

            return () => {
                stopPolling();
                if (channelRef.current) {
                    try {
                        supabase.removeChannel(channelRef.current);
                    } catch { }
                    channelRef.current = null;
                }
            };
        }, [online, subscribeRealtime, startPolling, stopPolling])
    );

    React.useEffect(() => {
        if (online) startPolling();
        else stopPolling();
    }, [online, startPolling, stopPolling]);

    const filteredProducts = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return products;
        return products.filter((p) => (p.name || "").toLowerCase().includes(q));
    }, [products, search]);

    const total = useMemo(() => rows.reduce((a, r) => a + (Number(r.qty) || 0) * (Number(r.price) || 0), 0), [rows]);

    const openPicker = (key: string) => setPickOpenFor(key);
    const selectProduct = (p: Product) => {
        setRows((prev) =>
            prev.map((r) => {
                if (r.key !== pickOpenFor) return r;
                const defPrice = getStorePrice({ storeId: id!, stores, product: p });
                return { ...r, product: p, price: String(defPrice) };
            })
        );
        setPickOpenFor(null);
        setSearch("");
    };

    const addRow = () => setRows((r) => [...r, { key: `r${r.length + 1}`, qty: "", price: "", unit: "дона" }]);

    const removeRow = (key: string) => setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));

    const saveAll = async () => {
        if (online) toast.showLoading("Saqlanmoqda…");
        else toast.showLoading("Offline: navbatga yozildi");
        for (const r of rows) {
            if (!r.product || !r.qty || !r.price) continue;
            await addReturn({
                storeId: id!,
                productName: r.product.name,
                qty: +r.qty,
                price: +r.price,
                unit: r.unit,
            });
        }
        setRows([{ key: "r1", qty: "", price: "", unit: "дона" }]);

        try {
            await useAppStore.getState().pushNow();
        } catch { }
        try {
            await useAppStore.getState().pullNow();
        } catch { }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
            <ScrollView
                style={{ flex: 1 }}
                contentContainerStyle={{ padding: 16, paddingBottom: 140 }}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={{ fontSize: 20, fontWeight: "800" }}>Қайтариш</Text>

                {rows.map((r) => (
                    <View
                        key={r.key}
                        style={{
                            backgroundColor: "#fff",
                            borderRadius: 12,
                            padding: 12,
                            borderWidth: 1,
                            borderColor: "#eee",
                            marginTop: 12,
                        }}
                    >
                        <Pressable
                            onPress={() => openPicker(r.key)}
                            style={{
                                padding: 12,
                                borderWidth: 1,
                                borderRadius: 10,
                                borderColor: "#ddd",
                                backgroundColor: "#F8F8FA",
                            }}
                        >
                            <Text>{r.product ? r.product.name : "Маҳсулотни танланг"}</Text>
                        </Pressable>

                        <View style={{ flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" }}>
                            <TextInput
                                placeholder="Миқдор"
                                value={r.qty}
                                onChangeText={(v) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, qty: v } : x)))}
                                keyboardType="numeric"
                                style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 }}
                            />
                            <TextInput
                                placeholder="Нарх"
                                value={r.price}
                                onChangeText={(v) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, price: v } : x)))}
                                keyboardType="numeric"
                                style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 }}
                            />

                            <TouchableOpacity
                                onPress={() => removeRow(r.key)}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: "#FCE9EA",
                                    borderWidth: 1,
                                    borderColor: "#F4C7CB",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <Ionicons name="remove-circle-outline" size={18} color="#770E13" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ marginTop: 6, fontWeight: "700" }}>
                            Summa: {((Number(r.qty) || 0) * (Number(r.price) || 0)).toLocaleString()} so‘m
                        </Text>
                    </View>
                ))}

                <TouchableOpacity
                    onPress={addRow}
                    style={{
                        alignSelf: "flex-start",
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        backgroundColor: "#780E14",
                        borderRadius: 12,
                        marginTop: 12,
                        borderWidth: 0,
                        shadowColor: "#000",
                        shadowOpacity: 0.08,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 2,
                    }}
                >
                    <Text style={{ fontWeight: "800", color: "#fff" }}>Қатор қўшиш</Text>
                </TouchableOpacity>

                <Text style={{ fontWeight: "800", marginTop: 12 }}>Умумий сумма: {total.toLocaleString()} so‘m</Text>

                <TouchableOpacity onPress={saveAll} style={{ backgroundColor: "#770E13", padding: 14, borderRadius: 12, marginTop: 8 }}>
                    <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800" }}>Сақлаш</Text>
                </TouchableOpacity>
            </ScrollView>

            <Modal visible={!!pickOpenFor} transparent animationType="fade" onRequestClose={() => setPickOpenFor(null)}>
                <Pressable
                    onPress={() => setPickOpenFor(null)}
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}
                >
                    <View style={{ backgroundColor: "#fff", borderRadius: 12, maxHeight: "70%", overflow: "hidden" }}>
                        <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee" }}>
                            <TextInput placeholder="Қидирув..." value={search} onChangeText={setSearch} style={{ borderWidth: 1, borderRadius: 10, padding: 10 }} />
                        </View>

                        <FlatList
                            data={filteredProducts}
                            keyExtractor={(p) => p.id}
                            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#f0f0f0" }} />}
                            renderItem={({ item }) => (
                                <TouchableOpacity onPress={() => selectProduct(item)} style={{ padding: 14 }}>
                                    <Text style={{ fontWeight: "700" }}>{item.name}</Text>
                                    <Text style={{ color: "#666", marginTop: 2 }}>
                                        Филиал: {item.priceBranch ?? 0} · Дўкон: {item.priceMarket ?? 0}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </Pressable>
            </Modal>

            <Toast />
        </KeyboardAvoidingView>
    );
}
