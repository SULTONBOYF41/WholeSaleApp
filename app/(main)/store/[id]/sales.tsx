import { C, Select } from "@/components/UI";
import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import type { Product, Unit } from "@/types";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

type Row = { key: string; product?: Product; qty: string; price: string; unit: Unit };
type MonthOpt = { label: string; value: string };

function monthRange(ym: string) {
    const [y, m] = ym.split("-").map(Number);
    const start = new Date(y, m - 1, 1).getTime();
    const end = new Date(y, m, 1).getTime() - 1;
    return { start, end };
}

export default function Sales() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const addSale = useAppStore((s) => s.addSale);
    const addCash = useAppStore((s) => s.addCash);
    const removeCash = useAppStore((s) => s.removeCash);
    const updateCash = useAppStore((s) => (s as any).updateCash); // ⬅️ patch qo‘shdik (pastda)
    const products = useAppStore((s) => s.products);
    const stores = useAppStore((s) => s.stores);
    const allReceipts = useAppStore((s) => s.cashReceipts).filter((r) => r.storeId === id);
    const online = useSyncStore((s) => s.online);

    const store = stores.find((s) => s.id === id);
    const [rows, setRows] = useState<Row[]>([{ key: "r1", qty: "", price: "", unit: "дона" }]);
    const [cash, setCash] = useState("");
    const [pickOpenFor, setPickOpenFor] = useState<string | null>(null);
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);

    // Tarix uchun oy filtri + CRUD modal holati
    const now = new Date();
    const defaultYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [ym, setYm] = useState(defaultYM);
    const { start, end } = monthRange(ym);

    const [editOpen, setEditOpen] = useState<{ id: string; amount: string } | null>(null);

    const receipts = useMemo(
        () => allReceipts.filter((x) => x.created_at >= start && x.created_at <= end).slice().reverse(),
        [allReceipts, start, end]
    );

    const total = useMemo(
        () => rows.reduce((a, r) => a + (Number(r.qty) || 0) * (Number(r.price) || 0), 0),
        [rows]
    );

    const openPicker = (rowKey: string) => setPickOpenFor(rowKey);

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
            if (online) {
                try { await useAppStore.getState().pushNow(); } catch { }
                try { await useAppStore.getState().pullNow(); } catch { }
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
    };

    // CRUD: edit/delete for receipts
    const startEditReceipt = (rid: string, amount: number) => {
        setEditOpen({ id: rid, amount: String(amount) });
    };
    const applyEditReceipt = async () => {
        if (!editOpen) return;
        const amt = Number(editOpen.amount || "0");
        if (!amt) { setEditOpen(null); return; }
        if (typeof updateCash === "function") {
            await updateCash(editOpen.id, amt);
        }
        setEditOpen(null);
    };

    return (
        <View style={{ flex: 1, padding: 16, gap: 12 }}>
            <Text style={{ fontSize: 20, fontWeight: "800" }}>Сотиш</Text>

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

            {/* Добавить строку – ko‘rinadiganroq */}
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

            {/* Olinğan pul (tarix + CRUD) */}
            <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 12, borderWidth: 1, borderColor: "#eee" }}>
                <Text style={{ fontWeight: "800", marginBottom: 8 }}>Олинган пул</Text>

                <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput
                        placeholder="0"
                        value={cash}
                        onChangeText={setCash}
                        keyboardType="numeric"
                        style={{ flex: 1, borderWidth: 1, borderRadius: 10, padding: 10 }}
                    />
                    <TouchableOpacity
                        onPress={saveCash}
                        style={{ backgroundColor: "#10B981", paddingHorizontal: 16, borderRadius: 10, justifyContent: "center" }}
                    >
                        <Text style={{ color: "#fff", fontWeight: "800" }}>Олиш</Text>
                    </TouchableOpacity>
                </View>

                {/* Oy filtri */}
                <View style={{ marginTop: 12 }}>
                    <Select
                        value={ym}
                        onChange={setYm}
                        options={(() => {
                            const arr: MonthOpt[] = [];
                            const names = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
                            const d = new Date();
                            for (let i = 0; i < 18; i++) {
                                const y = d.getFullYear(), m = d.getMonth() + 1;
                                arr.push({ value: `${y}-${String(m).padStart(2, "0")}`, label: `${names[m - 1]} ${y}` });
                                d.setMonth(d.getMonth() - 1);
                            }
                            return arr;
                        })()}
                        placeholder="Ойни танланг"
                    />
                </View>

                {/* Tarix (CRUD) */}
                <View style={{ marginTop: 10 }}>
                    <Text style={{ fontWeight: "700", marginBottom: 6 }}>Тарих</Text>
                    {receipts.length === 0 ? (
                        <Text style={{ color: "#777" }}>Ҳали тушум йўқ</Text>
                    ) : (
                        receipts.map((r) => (
                            <View key={r.id} style={{ flexDirection: "row", alignItems: "center", paddingVertical: 8 }}>
                                <View style={{ flex: 1 }}>
                                    <Text style={{ fontWeight: "800" }}>{r.amount.toLocaleString()} so‘m</Text>
                                    <Text style={{ color: "#888", fontSize: 12, marginTop: 2 }}>
                                        {new Date(r.created_at).toLocaleString()}
                                    </Text>
                                </View>
                                <View style={{ flexDirection: "row", gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={() => startEditReceipt(r.id, r.amount)}
                                        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, borderWidth: 1, borderColor: C.border, backgroundColor: "#fff" }}
                                    >
                                        <Text style={{ color: C.text, fontWeight: "700" }}>Ред.</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => removeCash(r.id)}
                                        style={{ paddingVertical: 8, paddingHorizontal: 12, borderRadius: 10, backgroundColor: "#E23D3D" }}
                                    >
                                        <Text style={{ color: "#fff", fontWeight: "800" }}>Удал.</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        ))
                    )}
                </View>
            </View>

            {/* Product picker modal + qidiruv */}
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

            {/* Saqlanyapti modal */}
            <Modal visible={saving} transparent animationType="fade">
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "center", alignItems: "center" }}>
                    <View style={{ backgroundColor: "#fff", padding: 16, borderRadius: 12, width: "70%", alignItems: "center" }}>
                        <ActivityIndicator size="large" color={C.primary} />
                        <Text style={{ marginTop: 12, fontWeight: "700" }}>Сақланяпти...</Text>
                    </View>
                </View>
            </Modal>

            {/* Receipt edit modal */}
            <Modal visible={!!editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(null)}>
                <Pressable onPress={() => setEditOpen(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}>
                    <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16 }}>
                        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Таҳрирлаш</Text>
                        <TextInput
                            placeholder="0"
                            value={editOpen?.amount ?? ""}
                            onChangeText={(v) => setEditOpen((st) => (st ? { ...st, amount: v } : st))}
                            keyboardType="numeric"
                            style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 10, minWidth: 200 }}
                        />
                        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                            <TouchableOpacity onPress={applyEditReceipt} style={{ backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }}>
                                <Text style={{ color: "#fff", fontWeight: "800" }}>Сақлаш</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => setEditOpen(null)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10, borderWidth: 1, borderColor: C.border }}>
                                <Text style={{ fontWeight: "700" }}>Бекор</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}
