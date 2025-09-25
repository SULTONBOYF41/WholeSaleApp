// app/(main)/returns.tsx
import Toast from "@/components/Toast";
import { getStorePrice } from "@/lib/pricing";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import { useToastStore } from "@/store/toastStore";
import type { Product, Unit } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    // === Global ===
    const currentStoreId = useAppStore((s) => s.currentStoreId);
    const setCurrentStore = useAppStore((s) => s.setCurrentStore);
    const stores = useAppStore((s) => s.stores);
    const products = useAppStore((s) => s.products);

    const addReturn = useAppStore((s) => s.addReturn);

    const online = useSyncStore((s) => s.online);
    const toast = useToastStore();

    // === Local UI ===
    const [rows, setRows] = useState<Row[]>([{ key: "r1", qty: "", price: "", unit: "дона" }]);
    const [pickOpenFor, setPickOpenFor] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    const effectiveStoreId = String(currentStoreId || "");
    const store = useMemo(
        () => stores.find((s) => String(s.id) === String(currentStoreId)),
        [stores, currentStoreId]
    );
    const NeedStore = !effectiveStoreId;

    const money = (n: number) => (n || 0).toLocaleString() + " so‘m";
    const parseNum = (v: string) => Number((v || "").replace(/\s/g, "")) || 0;

    const filteredProducts = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return products;
        return products.filter((p) => (p.name || "").toLowerCase().includes(q));
    }, [products, search]);

    const total = useMemo(
        () => rows.reduce((a, r) => a + parseNum(r.qty) * parseNum(r.price), 0),
        [rows]
    );

    const openPicker = (key: string) => setPickOpenFor(key);

    const selectProduct = (p: Product) => {
        const defPrice = getStorePrice({ storeId: effectiveStoreId, stores, product: p });
        setRows((prev) =>
            prev.map((r) => (r.key === pickOpenFor ? { ...r, product: p, price: String(defPrice ?? "") } : r))
        );
        setPickOpenFor(null);
        setSearch("");
    };

    const addRow = () =>
        setRows((r) => [...r, { key: `r${r.length + 1}`, qty: "", price: "", unit: "дона" }]);

    const removeRow = (key: string) =>
        setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));

    const saveAll = async () => {
        if (!effectiveStoreId) return;

        if (online) toast.showLoading("Saqlanmoqda…");
        else toast.showLoading("Offline: navbatga yozildi");

        for (const r of rows) {
            if (!r.product || !parseNum(r.qty) || !parseNum(r.price)) continue;
            await addReturn({
                storeId: effectiveStoreId,
                productName: r.product.name,
                qty: parseNum(r.qty),
                price: parseNum(r.price),
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

        try {
            toast.hide();
        } catch { }
    };

    // returns uchun realtime (faqat umumiy refresh uchun)
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

    useEffect(() => {
        setRows([{ key: "r1", qty: "", price: "", unit: "дона" }]);
        setSearch("");

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
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveStoreId]);

    useEffect(() => {
        if (online) startPolling();
        else stopPolling();
    }, [online, startPolling, stopPolling]);

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

                {/* Store info yoki ogohlantirish */}
                {NeedStore ? (
                    <View
                        style={{
                            marginTop: 8,
                            padding: 12,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "#E9ECF1",
                            backgroundColor: "#FFF7ED",
                        }}
                    >
                        <Text style={{ fontWeight: "800", color: "#7C2D12" }}>
                            Avval filial yoki do‘konni tanlang.
                        </Text>
                    </View>
                ) : (
                    <View
                        style={{
                            marginBottom: 8,
                            padding: 10,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "#E9ECF1",
                            backgroundColor: "#F9FAFB",
                        }}
                    >
                        <Text style={{ fontWeight: "800" }}>
                            {store ? `${store.name} (${store.type === "branch" ? "Filial" : "Do‘kon"})` : "Store topilmadi"}
                        </Text>
                        <Text style={{ color: "#6B7280", marginTop: 2, fontSize: 12 }}>
                            ID: {effectiveStoreId || "—"}
                        </Text>
                    </View>
                )}

                <Text style={{ fontSize: 20, fontWeight: "800", marginTop: 6 }}>Қайтариш</Text>

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
                            disabled={NeedStore}
                            style={{
                                padding: 12,
                                borderWidth: 1,
                                borderRadius: 10,
                                borderColor: NeedStore ? "#f0f0f0" : "#ddd",
                                backgroundColor: NeedStore ? "#fafafa" : "#F8F8FA",
                                opacity: NeedStore ? 0.7 : 1,
                            }}
                        >
                            <Text>{r.product ? r.product.name : "Маҳсулотни танланг"}</Text>
                        </Pressable>

                        <View style={{ flexDirection: "row", gap: 8, marginTop: 10, alignItems: "center" }}>
                            <TextInput
                                placeholder="Миқдор"
                                value={r.qty}
                                onChangeText={(v) =>
                                    setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, qty: v } : x)))
                                }
                                keyboardType="numeric"
                                style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 }}
                                editable={!NeedStore}
                            />
                            <TextInput
                                placeholder="Нарх"
                                value={r.price}
                                onChangeText={(v) =>
                                    setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, price: v } : x)))
                                }
                                keyboardType="numeric"
                                style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 }}
                                editable={!NeedStore}
                            />

                            <TouchableOpacity
                                onPress={() => removeRow(r.key)}
                                disabled={NeedStore}
                                style={{
                                    width: 36,
                                    height: 36,
                                    borderRadius: 18,
                                    backgroundColor: "#FCE9EA",
                                    borderWidth: 1,
                                    borderColor: "#F4C7CB",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    opacity: NeedStore ? 0.6 : 1,
                                }}
                            >
                                <Ionicons name="remove-circle-outline" size={18} color="#770E13" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ marginTop: 6, fontWeight: "700" }}>
                            Summa: {money(parseNum(r.qty) * parseNum(r.price))}
                        </Text>
                    </View>
                ))}

                <TouchableOpacity
                    onPress={addRow}
                    disabled={NeedStore}
                    style={{
                        alignSelf: "flex-start",
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        backgroundColor: "#780E14",
                        borderRadius: 12,
                        marginTop: 12,
                        shadowColor: "#000",
                        shadowOpacity: 0.08,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 2 },
                        elevation: 2,
                        opacity: NeedStore ? 0.6 : 1,
                    }}
                >
                    <Text style={{ fontWeight: "800", color: "#fff" }}>Қатор қўшиш</Text>
                </TouchableOpacity>

                <Text style={{ fontWeight: "800", marginTop: 12 }}>
                    Умумий сумма: {money(total)}
                </Text>

                <TouchableOpacity
                    onPress={saveAll}
                    disabled={NeedStore}
                    style={{
                        backgroundColor: "#770E13",
                        padding: 14,
                        borderRadius: 12,
                        marginTop: 8,
                        opacity: NeedStore ? 0.6 : 1,
                    }}
                >
                    <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800" }}>Сақлаш</Text>
                </TouchableOpacity>
            </ScrollView>

            {/* Product picker */}
            <Modal visible={!!pickOpenFor} transparent animationType="fade" onRequestClose={() => setPickOpenFor(null)}>
                <Pressable
                    onPress={() => setPickOpenFor(null)}
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}
                >
                    <View style={{ backgroundColor: "#fff", borderRadius: 12, maxHeight: "70%", overflow: "hidden" }}>
                        <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee" }}>
                            <TextInput
                                placeholder="Қидирув..."
                                value={search}
                                onChangeText={setSearch}
                                style={{ borderWidth: 1, borderRadius: 10, padding: 10 }}
                            />
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
