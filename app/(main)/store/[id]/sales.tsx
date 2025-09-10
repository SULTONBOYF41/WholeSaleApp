import { useAppStore } from "@/store/appStore";
import type { Product, Unit } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
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

export default function Sales() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const addSale = useAppStore((s) => s.addSale);
    const addCash = useAppStore((s) => s.addCash);
    const updateCash = useAppStore((s) => s.updateCash);
    const removeCash = useAppStore((s) => s.removeCash);

    const products = useAppStore((s) => s.products);
    const stores = useAppStore((s) => s.stores);
    const receiptsAll = useAppStore((s) => s.cashReceipts);

    const receipts = receiptsAll.filter((r) => r.storeId === id);
    const store = stores.find((s) => s.id === id);

    const [rows, setRows] = useState<Row[]>([{ key: "r1", qty: "", price: "", unit: "дона" }]);
    const [cash, setCash] = useState("");
    const [pickOpenFor, setPickOpenFor] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);

    // Tarix collapsible
    const [showHistory, setShowHistory] = useState(false);

    // Cash edit modal
    const [editCashId, setEditCashId] = useState<string | null>(null);
    const [editCashAmount, setEditCashAmount] = useState("");

    const filteredProducts = useMemo(() => {
        const q = search.trim().toLowerCase();
        if (!q) return products;
        return products.filter((p) => p.name.toLowerCase().includes(q));
    }, [products, search]);

    const total = useMemo(
        () => rows.reduce((a, r) => a + (Number(r.qty) || 0) * (Number(r.price) || 0), 0),
        [rows]
    );

    const openPicker = (rowKey: string) => setPickOpenFor(rowKey);
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

    const removeRow = (key: string) =>
        setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));

    const saveAll = async () => {
        setSaving(true);
        try {
            for (const r of rows) {
                if (!r.product || !r.qty || !r.price) continue;
                await addSale({
                    storeId: id!,
                    productName: r.product.name,
                    qty: +r.qty,
                    price: +r.price,
                    unit: r.unit,
                });
            }
            setRows([{ key: "r1", qty: "", price: "", unit: "дона" }]);
        } finally {
            setSaving(false);
        }
    };

    const saveCash = async () => {
        const amt = Number(cash || "0");
        if (!amt) return;
        await addCash(id!, amt);
        setCash("");
        setShowHistory(true); // qo‘shilgandan so‘ng tarixni ko‘rsatamiz
    };

    const openEditCash = (cid: string, amount: number) => {
        setEditCashId(cid);
        setEditCashAmount(String(amount));
    };

    const submitEditCash = async () => {
        if (!editCashId) return;
        const amt = Number(editCashAmount || "0");
        await updateCash(editCashId, amt);
        setEditCashId(null);
    };

    const deleteCashItem = async (cid: string) => {
        await removeCash(cid);
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
                <Text style={{ fontSize: 20, fontWeight: "800" }}>Сотиш</Text>

                {/* Qatorlar ro'yxati */}
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
                                onChangeText={(v) =>
                                    setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, qty: v } : x)))
                                }
                                keyboardType="numeric"
                                style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 }}
                            />
                            <TextInput
                                placeholder="Нарх"
                                value={r.price}
                                onChangeText={(v) =>
                                    setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, price: v } : x)))
                                }
                                keyboardType="numeric"
                                style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 }}
                            />

                            {/* minus – dumaloq tugma */}
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
                                <Ionicons name="remove" size={18} color="#770E13" />
                            </TouchableOpacity>
                        </View>

                        <Text style={{ marginTop: 6, fontWeight: "700" }}>
                            Summa: {((Number(r.qty) || 0) * (Number(r.price) || 0)).toLocaleString()} so‘m
                        </Text>
                    </View>
                ))}

                {/* Yangi qator qo'shish */}
                <TouchableOpacity
                    onPress={addRow}
                    style={{
                        alignSelf: "flex-start",
                        paddingVertical: 10,
                        paddingHorizontal: 14,
                        backgroundColor: "#780E14",        // 🔴 qizil fon (asosiy rang)
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


                <Text style={{ fontWeight: "800", marginTop: 12 }}>
                    Умумий сумма: {total.toLocaleString()} so‘m
                </Text>

                <TouchableOpacity
                    onPress={saveAll}
                    style={{
                        backgroundColor: "#770E13",
                        padding: 14,
                        borderRadius: 12,
                        marginTop: 8,
                    }}
                >
                    <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800" }}>Сақлаш</Text>
                    {/* saqlanmoqda overlay emas, lekin button ichida indikator ko'rsatish ham mumkin */}
                </TouchableOpacity>

                {/* Olingan pul */}
                <View
                    style={{
                        backgroundColor: "#fff",
                        borderRadius: 12,
                        padding: 12,
                        borderWidth: 1,
                        borderColor: "#eee",
                        marginTop: 16,
                    }}
                >
                    <Text style={{ fontWeight: "800", marginBottom: 8 }}>Олинган пул</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        <TextInput
                            placeholder="0"
                            value={cash}
                            onChangeText={setCash}
                            keyboardType="numeric"
                            style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 }}
                        />
                        <TouchableOpacity
                            onPress={saveCash}
                            style={{
                                backgroundColor: "#10B981",
                                paddingHorizontal: 16,
                                borderRadius: 10,
                                justifyContent: "center",
                            }}
                        >
                            <Text style={{ color: "#fff", fontWeight: "800" }}>Олиш</Text>
                        </TouchableOpacity>
                    </View>

                    {/* Tarix header (collapsible toggle) */}
                    <TouchableOpacity
                        onPress={() => setShowHistory((v) => !v)}
                        style={{
                            marginTop: 12,
                            flexDirection: "row",
                            alignItems: "center",
                            justifyContent: "space-between",
                        }}
                    >
                        <Text style={{ fontWeight: "700" }}>Тарих</Text>
                        <Ionicons name={showHistory ? "chevron-up" : "chevron-down"} size={18} color="#333" />
                    </TouchableOpacity>

                    {/* Tarix ro‘yxati */}
                    {showHistory && (
                        <View style={{ marginTop: 6 }}>
                            {receipts.length === 0 ? (
                                <Text style={{ color: "#777" }}>Ҳали тушум йўқ</Text>
                            ) : (
                                receipts
                                    .slice()
                                    .reverse()
                                    .map((r) => (
                                        <View
                                            key={r.id}
                                            style={{
                                                flexDirection: "row",
                                                alignItems: "center",
                                                justifyContent: "space-between",
                                                paddingVertical: 8,
                                                borderTopWidth: 1,
                                                borderTopColor: "#F0F0F0",
                                            }}
                                        >
                                            {/* chap: summa + sana */}
                                            <View style={{ flex: 1, paddingRight: 10 }}>
                                                <Text style={{ fontWeight: "800" }}>{r.amount.toLocaleString()} so‘m</Text>
                                                <Text style={{ color: "#777", fontSize: 12, marginTop: 2 }}>
                                                    {new Date(r.created_at).toLocaleString()}
                                                </Text>
                                            </View>

                                            {/* o‘ng: edit / delete */}
                                            <View style={{ flexDirection: "row", gap: 8 }}>
                                                <TouchableOpacity
                                                    onPress={() => openEditCash(r.id, r.amount)}
                                                    style={{
                                                        width: 36,
                                                        height: 36,
                                                        borderRadius: 18,
                                                        backgroundColor: "#fff",
                                                        borderWidth: 1,
                                                        borderColor: "#E9ECF1",
                                                        alignItems: "center",
                                                        justifyContent: "center",
                                                    }}
                                                >
                                                    <Ionicons name="create-outline" size={18} color="#770E13" />
                                                </TouchableOpacity>
                                                <TouchableOpacity
                                                    onPress={() => deleteCashItem(r.id)}
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
                                                    <Ionicons name="close-outline" size={18} color="#E23D3D" />
                                                </TouchableOpacity>
                                            </View>
                                        </View>
                                    ))
                            )}
                        </View>
                    )}
                </View>
            </ScrollView>

            {/* Saqlanmoqda overlay */}
            {saving && (
                <View
                    pointerEvents="none"
                    style={{
                        position: "absolute",
                        left: 0,
                        right: 0,
                        bottom: 0,
                        top: 0,
                        backgroundColor: "rgba(0,0,0,0.15)",
                        alignItems: "center",
                        justifyContent: "center",
                    }}
                >
                    <View
                        style={{
                            backgroundColor: "#fff",
                            paddingHorizontal: 18,
                            paddingVertical: 14,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: "#eee",
                            flexDirection: "row",
                            alignItems: "center",
                            gap: 10,
                        }}
                    >
                        <ActivityIndicator />
                        <Text style={{ fontWeight: "800" }}>Сақланяпти…</Text>
                    </View>
                </View>
            )}

            {/* Product picker modal */}
            <Modal
                visible={!!pickOpenFor}
                transparent
                animationType="fade"
                onRequestClose={() => setPickOpenFor(null)}
            >
                <Pressable
                    onPress={() => setPickOpenFor(null)}
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}
                >
                    <View style={{ backgroundColor: "#fff", borderRadius: 12, maxHeight: "70%", overflow: "hidden" }}>
                        {/* Qidiruv */}
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

            {/* Cash edit modal */}
            <Modal
                visible={!!editCashId}
                transparent
                animationType="fade"
                onRequestClose={() => setEditCashId(null)}
            >
                <Pressable
                    onPress={() => setEditCashId(null)}
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}
                >
                    <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14 }}>
                        <Text style={{ fontWeight: "800" }}>Олинган пулни таҳрирлаш</Text>
                        <Text style={{ marginTop: 8 }}>Сумма</Text>
                        <TextInput
                            value={editCashAmount}
                            onChangeText={setEditCashAmount}
                            keyboardType="numeric"
                            style={{ borderWidth: 1, borderColor: "#E9ECF1", borderRadius: 10, padding: 10, marginTop: 4 }}
                        />
                        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                            <TouchableOpacity
                                onPress={() => setEditCashId(null)}
                                style={{
                                    flex: 1,
                                    backgroundColor: "#F5F6FA",
                                    borderRadius: 12,
                                    paddingVertical: 12,
                                    alignItems: "center",
                                }}
                            >
                                <Text style={{ fontWeight: "800" }}>Бекор</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={submitEditCash}
                                style={{
                                    flex: 1,
                                    backgroundColor: "#770E13",
                                    borderRadius: 12,
                                    paddingVertical: 12,
                                    alignItems: "center",
                                }}
                            >
                                <Text style={{ fontWeight: "800", color: "#fff" }}>Сақлаш</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </KeyboardAvoidingView>
    );
}
