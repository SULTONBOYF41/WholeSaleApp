import { C } from "@/components/UI";
import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import type { Product, Unit } from "@/types";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from "react-native";

type Row = { key: string; product?: Product; qty: string; price: string; unit: Unit };

export default function Returns() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const addReturn = useAppStore((s) => s.addReturn);
    const products = useAppStore((s) => s.products);
    const stores = useAppStore((s) => s.stores);
    const store = stores.find((s) => s.id === id);
    const online = useSyncStore((s) => s.online);

    const [rows, setRows] = useState<Row[]>([{ key: "r1", qty: "", price: "", unit: "дона" }]);
    const [pickOpenFor, setPickOpenFor] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);

    const total = useMemo(
        () => rows.reduce((a, r) => a + (Number(r.qty) || 0) * (Number(r.price) || 0), 0),
        [rows]
    );

    const openPicker = (key: string) => setPickOpenFor(key);

    const filteredProducts = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return products;
        return products.filter((p) => p.name.toLowerCase().includes(q));
    }, [products, search]);

    const selectProduct = (p: Product) => {
        setRows((prev) =>
            prev.map((r) => {
                if (r.key !== pickOpenFor) return r;
                const defPrice = store?.type === "branch" ? p.priceBranch ?? 0 : p.priceMarket ?? 0;
                return { ...r, product: p, price: String(defPrice) };
            })
        );
        setPickOpenFor(null);
        setSearch("");
    };

    const addRow = () =>
        setRows((r) => [...r, { key: `r${r.length + 1}`, qty: "", price: "", unit: "дона" }]);

    const removeRow = (key: string) => setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));

    const saveAll = async () => {
        setSaving(true);
        try {
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
            if (online) {
                try { await useAppStore.getState().pushNow(); } catch { }
                try { await useAppStore.getState().pullNow(); } catch { }
            }
            setRows([{ key: "r1", qty: "", price: "", unit: "дона" }]);
        } finally {
            setSaving(false);
        }
    };

    return (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: "800" }}>Қайтариш</Text>

            {rows.map((r) => (
                <View
                    key={r.key}
                    style={{ backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#eee" }}
                >
                    <Pressable
                        onPress={() => openPicker(r.key)}
                        style={{ padding: 10, borderWidth: 1, borderRadius: 10, borderColor: "#ddd", backgroundColor: "#F8F8FA" }}
                    >
                        <Text>{r.product ? r.product.name : "Маҳсулотни танланг"}</Text>
                    </Pressable>

                    <View style={{ flexDirection: "row", gap: 8, marginTop: 8, alignItems: "center" }}>
                        <TextInput
                            placeholder="Миқдор"
                            value={r.qty}
                            onChangeText={(v) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, qty: v } : x)))}
                            keyboardType="numeric"
                            style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 10 }}
                        />
                        <TextInput
                            placeholder="Нарх"
                            value={r.price}
                            onChangeText={(v) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, price: v } : x)))}
                            keyboardType="numeric"
                            style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 10 }}
                        />

                        {/* Dumaloq minus tugma */}
                        <TouchableOpacity
                            onPress={() => removeRow(r.key)}
                            style={{
                                width: 36, height: 36, borderRadius: 18, backgroundColor: C.primarySoft,
                                borderWidth: 1, borderColor: "#F4C7CB", alignItems: "center", justifyContent: "center"
                            }}
                        >
                            <Text style={{ color: C.primary, fontWeight: "900", fontSize: 18 }}>−</Text>
                        </TouchableOpacity>
                    </View>

                    <Text style={{ marginTop: 6, fontWeight: "700" }}>
                        Summa: {((Number(r.qty) || 0) * (Number(r.price) || 0)).toLocaleString()} so‘m
                    </Text>
                </View>
            ))}

            <TouchableOpacity
                onPress={addRow}
                style={{ alignSelf: "flex-start", paddingVertical: 10, paddingHorizontal: 14, backgroundColor: C.primary, borderRadius: 10 }}
            >
                <Text style={{ color: "#fff", fontWeight: "800" }}>Добавить строку</Text>
            </TouchableOpacity>

            <Text style={{ fontWeight: "800" }}>Умумий сумма: {total.toLocaleString()} so‘m</Text>

            <TouchableOpacity onPress={saveAll} style={{ backgroundColor: C.primary, padding: 14, borderRadius: 12 }}>
                <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800" }}>Сақлаш</Text>
            </TouchableOpacity>

            {/* Popup (qidiruv bilan) */}
            <Modal visible={!!pickOpenFor} transparent animationType="fade" onRequestClose={() => setPickOpenFor(null)}>
                <Pressable onPress={() => setPickOpenFor(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}>
                    <View style={{ backgroundColor: "#fff", borderRadius: 12, maxHeight: "75%", width: "100%" }}>
                        {/* Qidiruv input */}
                        <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee" }}>
                            <TextInput
                                placeholder="Қидириш..."
                                value={search}
                                onChangeText={setSearch}
                                style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 10 }}
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
                            style={{ maxHeight: "100%" }}
                        />
                    </View>
                </Pressable>
            </Modal>

            {/* Yuborilyapti modal */}
            <Modal visible={saving} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "center", alignItems: "center" }}>
                    <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 12, width: "70%", alignItems: "center" }}>
                        <ActivityIndicator size="large" color={C.primary} />
                        <Text style={{ marginTop: 12, fontWeight: "700" }}>Юбориляпти...</Text>
                    </View>
                </View>
            </Modal>
        </View>
    );
}
