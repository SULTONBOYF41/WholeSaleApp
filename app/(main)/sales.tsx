// app/(main)/sales.tsx
import Toast from "@/components/Toast";
import { getStorePrice } from "@/lib/pricing";
import { api } from "@/lib/api";
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

type CashReceiptView = {
    id: string;
    store_id: string;
    amount: number;
    note?: string | null;
    created_at: string;
};

const PRIMARY = "#770E13";

export default function Sales() {
    const currentStoreId = useAppStore((s) => s.currentStoreId);
    const stores = useAppStore((s) => s.stores);
    const products = useAppStore((s) => s.products);

    const addSale = useAppStore((s) => s.addSale);
    const pushNow = useAppStore((s) => s.pushNow);
    const pullNow = useAppStore((s) => s.pullNow);

    const addCashOffline = useAppStore((s) => s.addCash);
    const updateCashOffline = useAppStore((s) => s.updateCash);
    const removeCashOffline = useAppStore((s) => s.removeCash);

    const online = useSyncStore((s) => s.online);
    const toast = useToastStore();

    const [rows, setRows] = useState<Row[]>([{ key: "r1", qty: "", price: "", unit: "дона" }]);
    const [cash, setCash] = useState("");
    const [pickOpenFor, setPickOpenFor] = useState<string | null>(null);
    const [search, setSearch] = useState("");

    const [receipts, setReceipts] = useState<CashReceiptView[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    const [editCashId, setEditCashId] = useState<string | null>(null);
    const [editCashAmount, setEditCashAmount] = useState("");

    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    const store = useMemo(
        () => stores.find((s) => String(s.id) === String(currentStoreId)),
        [stores, currentStoreId]
    );
    const effectiveStoreId = String(currentStoreId || "");

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

    const NeedStore = !effectiveStoreId;

    const openPicker = (rowKey: string) => setPickOpenFor(rowKey);

    const selectProduct = (p: Product) => {
        const defPrice = getStorePrice({ storeId: effectiveStoreId, stores, product: p });
        setRows((prev) =>
            prev.map((r) =>
                r.key === pickOpenFor ? { ...r, product: p, price: defPrice != null ? String(defPrice) : r.price } : r
            )
        );
        setPickOpenFor(null);
        setSearch("");
    };

    const addRow = () => setRows((r) => [...r, { key: `r${r.length + 1}`, qty: "", price: "", unit: "дона" }]);
    const removeRow = (key: string) => setRows((r) => (r.length > 1 ? r.filter((x) => x.key !== key) : r));

    const saveAll = async () => {
        if (!effectiveStoreId) {
            toast.show("Iltimos, do‘konni tanlang.");
            return;
        }

        toast.showLoading(online ? "Saqlanmoqda…" : "Offline: navbatga yozildi");

        const batchId = "b-" + Date.now().toString(36);

        try {
            for (const r of rows) {
                if (!r.product) continue;

                let priceNum = parseNum(r.price);
                if (!priceNum) {
                    const defPrice = getStorePrice({ storeId: effectiveStoreId, stores, product: r.product });
                    priceNum = Number(defPrice || 0);
                }

                const qtyNum = parseNum(r.qty);
                if (!qtyNum || !priceNum) continue;

                await addSale({
                    storeId: effectiveStoreId,
                    productName: r.product.name,
                    qty: qtyNum,
                    price: priceNum,
                    unit: r.unit || "дона",
                    batchId,
                });
            }

            setRows([{ key: "r1", qty: "", price: "", unit: "дона" }]);

            // online bo‘lsa urinamiz
            if (online) {
                try { await pushNow(); } catch { }
                try { await pullNow(); } catch { }
            }
        } finally {
            try { toast.hide(); } catch { }
        }
    };

    // ===== CASH (tushum) — backenddan o‘qish =====
    const loadReceipts = useCallback(async () => {
        if (!effectiveStoreId) return;

        // backend: GET /api/cash-receipts?store_id=...
        try {
            const r = await api.cash.list(effectiveStoreId);
            const list = (r.data || []) as any[];
            setReceipts(
                list.map((x) => ({
                    id: x.id,
                    store_id: x.store_id ?? x.storeId,
                    amount: Number(x.amount || 0),
                    note: x.note ?? null,
                    created_at: x.created_at,
                }))
            );
        } catch {
            // offline: lokal cash’larni ko‘rsatamiz (optimistic)
            const local = useAppStore.getState().cashReceipts || [];
            const view = local
                .filter((x: any) => String(x.storeId) === String(effectiveStoreId))
                .slice()
                .sort((a: any, b: any) => (b.created_at || 0) - (a.created_at || 0))
                .map((x: any) => ({
                    id: x.id,
                    store_id: x.storeId,
                    amount: Number(x.amount || 0),
                    note: null,
                    created_at: new Date(x.created_at || Date.now()).toISOString(),
                }));
            setReceipts(view);
        }
    }, [effectiveStoreId]);

    const startPolling = useCallback(() => {
        if (pollRef.current) return;
        pollRef.current = setInterval(() => {
            loadReceipts().catch(() => { });
        }, 8000);
    }, [loadReceipts]);

    const stopPolling = useCallback(() => {
        if (pollRef.current) {
            clearInterval(pollRef.current);
            pollRef.current = null;
        }
    }, []);

    useEffect(() => {
        setRows([{ key: "r1", qty: "", price: "", unit: "дона" }]);
        setSearch("");
        setShowHistory(false);
        setCash("");

        loadReceipts().catch(() => { });
        if (online) startPolling();

        return () => stopPolling();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [effectiveStoreId]);

    useEffect(() => {
        if (online) startPolling();
        else stopPolling();
    }, [online, startPolling, stopPolling]);

    const saveCash = async () => {
        const amt = parseNum(cash);
        if (!amt || !effectiveStoreId) return;

        toast.showLoading(online ? "Saqlanmoqda…" : "Offline: navbatga yozildi");

        try {
            // backendda cash create endpoint yo‘q -> doim offline queue
            await addCashOffline(effectiveStoreId, amt);
            setCash("");
            setShowHistory(true);

            if (online) {
                try { await pushNow(); } catch { }
                await loadReceipts();
            }
        } finally {
            try { toast.hide(); } catch { }
        }
    };

    const submitEditCash = async () => {
        if (!editCashId) return;
        const amt = parseNum(editCashAmount);

        toast.showLoading(online ? "Saqlanmoqda…" : "Offline: navbatga yozildi");
        try {
            await updateCashOffline(editCashId, amt);

            setEditCashId(null);

            if (online) {
                try { await pushNow(); } catch { }
                await loadReceipts();
            }
        } finally {
            try { toast.hide(); } catch { }
        }
    };

    const deleteCashItem = async (cid: string) => {
        toast.showLoading(online ? "Saqlanmoqda…" : "Offline: navbatga yozildi");
        try {
            await removeCashOffline(cid);

            if (online) {
                try { await pushNow(); } catch { }
                await loadReceipts();
            }
        } finally {
            try { toast.hide(); } catch { }
        }
    };

    return (
        <KeyboardAvoidingView
            style={{ flex: 1 }}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            keyboardVerticalOffset={Platform.OS === "ios" ? 80 : 0}
        >
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
                {NeedStore ? (
                    <View style={{ marginTop: 8, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: "#E9ECF1", backgroundColor: "#FFF7ED" }}>
                        <Text style={{ fontWeight: "800", color: "#7C2D12" }}>Avval filial yoki do‘konni tanlang.</Text>
                    </View>
                ) : (
                    <View style={{ marginBottom: 8, padding: 10, borderRadius: 12, borderWidth: 1, borderColor: "#E9ECF1", backgroundColor: "#F9FAFB" }}>
                        <Text style={{ fontWeight: "800" }}>
                            {store ? `${store.name} (${store.type === "branch" ? "Filial" : "Do‘kon"})` : "Store topilmadi"}
                        </Text>
                        <Text style={{ color: "#6B7280", marginTop: 2, fontSize: 12 }}>ID: {effectiveStoreId || "—"}</Text>
                    </View>
                )}

                <Text style={{ fontSize: 20, fontWeight: "800", marginTop: 6 }}>Сотиш</Text>

                {rows.map((r) => (
                    <View key={r.key} style={{ backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#eee", marginTop: 12 }}>
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
                                onChangeText={(v) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, qty: v } : x)))}
                                keyboardType="numeric"
                                style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 }}
                                editable={!NeedStore}
                            />
                            <TextInput
                                placeholder="Нарх (bo'sh qoldirsangiz — default olinadi)"
                                value={r.price}
                                onChangeText={(v) => setRows((rs) => rs.map((x) => (x.key === r.key ? { ...x, price: v } : x)))}
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
                                <Ionicons name="remove-circle-outline" size={18} color={PRIMARY} />
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
                        backgroundColor: PRIMARY,
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

                <Text style={{ fontWeight: "800", marginTop: 12 }}>Умумiy summa: {money(total)}</Text>

                <TouchableOpacity onPress={saveAll} disabled={NeedStore} style={{ backgroundColor: PRIMARY, padding: 14, borderRadius: 12, marginTop: 8, opacity: NeedStore ? 0.6 : 1 }}>
                    <Text style={{ color: "#fff", textAlign: "center", fontWeight: "800" }}>Сақлаш</Text>
                </TouchableOpacity>

                {/* CASH */}
                <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#eee", marginTop: 16 }}>
                    <Text style={{ fontWeight: "800", marginBottom: 8 }}>Олинган пул</Text>
                    <View style={{ flexDirection: "row", gap: 8 }}>
                        <TextInput placeholder="0" value={cash} onChangeText={setCash} keyboardType="numeric" style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 12 }} editable={!NeedStore} />
                        <TouchableOpacity
                            onPress={saveCash}
                            disabled={NeedStore}
                            style={{ backgroundColor: "#10B981", paddingHorizontal: 16, borderRadius: 10, justifyContent: "center", opacity: NeedStore ? 0.6 : 1 }}
                        >
                            <Text style={{ color: "#fff", fontWeight: "800" }}>Оlish</Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity onPress={() => setShowHistory((v) => !v)} style={{ marginTop: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                        <Text style={{ fontWeight: "700" }}>Тarix</Text>
                        <Ionicons name={showHistory ? "chevron-up" : "chevron-down"} size={18} color="#333" />
                    </TouchableOpacity>

                    {showHistory && (
                        <View style={{ marginTop: 6 }}>
                            {receipts.length === 0 ? (
                                <Text style={{ color: "#777" }}>Ҳali tushum yo‘q</Text>
                            ) : (
                                receipts.map((r) => (
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
                                        <View style={{ flex: 1, paddingRight: 10 }}>
                                            <Text style={{ fontWeight: "800" }}>{(Number(r.amount) || 0).toLocaleString()} so‘m</Text>
                                            <Text style={{ color: "#777", fontSize: 12, marginTop: 2 }}>{new Date(r.created_at).toLocaleString()}</Text>
                                        </View>

                                        <View style={{ flexDirection: "row", gap: 8 }}>
                                            <TouchableOpacity
                                                onPress={() => {
                                                    setEditCashId(r.id);
                                                    setEditCashAmount(String(r.amount));
                                                }}
                                                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#fff", borderWidth: 1, borderColor: "#E9ECF1", alignItems: "center", justifyContent: "center" }}
                                            >
                                                <Ionicons name="create-outline" size={18} color={PRIMARY} />
                                            </TouchableOpacity>

                                            <TouchableOpacity
                                                onPress={() => deleteCashItem(r.id)}
                                                style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: "#FCE9EA", borderWidth: 1, borderColor: "#F4C7CB", alignItems: "center", justifyContent: "center" }}
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

            {/* Product picker */}
            <Modal visible={!!pickOpenFor} transparent animationType="fade" onRequestClose={() => setPickOpenFor(null)}>
                <Pressable onPress={() => setPickOpenFor(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}>
                    <View style={{ backgroundColor: "#fff", borderRadius: 12, maxHeight: "70%", overflow: "hidden" }}>
                        <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee" }}>
                            <TextInput placeholder="Қidiruv..." value={search} onChangeText={setSearch} style={{ borderWidth: 1, borderRadius: 10, padding: 10 }} />
                        </View>
                        <FlatList
                            data={filteredProducts}
                            keyExtractor={(p) => p.id}
                            ItemSeparatorComponent={() => <View style={{ height: 1, backgroundColor: "#f0f0f0" }} />}
                            renderItem={({ item }) => (
                                <TouchableOpacity onPress={() => selectProduct(item)} style={{ padding: 14 }}>
                                    <Text style={{ fontWeight: "700" }}>{item.name}</Text>
                                    <Text style={{ color: "#666", marginTop: 2 }}>
                                        Филиal: {item.priceBranch ?? 0} · Do‘kon: {item.priceMarket ?? 0}
                                    </Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </Pressable>
            </Modal>

            {/* Edit cash */}
            <Modal visible={!!editCashId} transparent animationType="fade" onRequestClose={() => setEditCashId(null)}>
                <Pressable onPress={() => setEditCashId(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}>
                    <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 14 }}>
                        <Text style={{ fontWeight: "800" }}>Оlinган pulni tahrirlash</Text>
                        <Text style={{ marginTop: 8 }}>Summa</Text>
                        <TextInput value={editCashAmount} onChangeText={setEditCashAmount} keyboardType="numeric" style={{ borderWidth: 1, borderColor: "#E9ECF1", borderRadius: 10, padding: 10, marginTop: 4 }} />
                        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                            <TouchableOpacity onPress={() => setEditCashId(null)} style={{ flex: 1, backgroundColor: "#F5F6FA", borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
                                <Text style={{ fontWeight: "800" }}>Bekor</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={submitEditCash} style={{ flex: 1, backgroundColor: PRIMARY, borderRadius: 12, paddingVertical: 12, alignItems: "center" }}>
                                <Text style={{ fontWeight: "800", color: "#fff" }}>Saqlash</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Modal>

            <Toast />
        </KeyboardAvoidingView>
    );
}
