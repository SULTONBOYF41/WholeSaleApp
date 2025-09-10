import { Button, C, Card, H1, H2, Select } from "@/components/UI";
import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from "react-native";

type Tab = "sales" | "returns";

function monthOptions(lastN = 12) {
    const now = new Date();
    const arr = [];
    for (let i = 0; i < lastN; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleString(undefined, { year: "numeric", month: "long" });
        arr.push({ label, value: val });
    }
    return arr;
}
function inSameMonth(ts: number, ym: string) {
    const d = new Date(ts);
    const [y, m] = ym.split("-").map(Number);
    return d.getFullYear() === y && d.getMonth() + 1 === m;
}

export default function History() {
    const { id } = useLocalSearchParams<{ id: string }>();

    const salesAll = useAppStore((s) => s.sales);
    const returnsAll = useAppStore((s) => s.returns);

    const updateSale = useAppStore((s) => s.updateSale);
    const removeSale = useAppStore((s) => s.removeSale);
    const updateReturn = useAppStore((s) => s.updateReturn);
    const removeReturn = useAppStore((s) => s.removeReturn);

    const online = useSyncStore((s) => s.online);
    const pushNow = useAppStore((s) => s.pushNow);
    const pullNow = useAppStore((s) => s.pullNow);

    const [tab, setTab] = useState<Tab>("sales");

    const opts = useMemo(() => monthOptions(18), []);
    const [month, setMonth] = useState(opts[0]?.value);

    const sales = useMemo(
        () =>
            salesAll
                .filter((x) => x.storeId === id && (!month || inSameMonth(x.created_at, month)))
                .sort((a, b) => b.created_at - a.created_at),
        [salesAll, id, month]
    );
    const returns = useMemo(
        () =>
            returnsAll
                .filter((x) => x.storeId === id && (!month || inSameMonth(x.created_at, month)))
                .sort((a, b) => b.created_at - a.created_at),
        [returnsAll, id, month]
    );

    // Edit modallar
    const [editSaleId, setEditSaleId] = useState<string | null>(null);
    const [editReturnId, setEditReturnId] = useState<string | null>(null);
    const [qty, setQty] = useState("");
    const [price, setPrice] = useState("");

    const openSaleEdit = (id: string, initQty: number, initPrice: number) => {
        setEditReturnId(null);
        setEditSaleId(id);
        setQty(String(initQty));
        setPrice(String(initPrice));
    };
    const openReturnEdit = (id: string, initQty: number, initPrice: number) => {
        setEditSaleId(null);
        setEditReturnId(id);
        setQty(String(initQty));
        setPrice(String(initPrice));
    };

    const saveSale = async () => {
        if (!editSaleId) return;
        await updateSale(editSaleId, { qty: Number(qty || "0"), price: Number(price || "0") });
        if (online) {
            try { await pushNow(); } catch { }
            try { await pullNow(); } catch { }
        }
        setEditSaleId(null);
    };
    const saveReturn = async () => {
        if (!editReturnId) return;
        await updateReturn(editReturnId, { qty: Number(qty || "0"), price: Number(price || "0") });
        if (online) {
            try { await pushNow(); } catch { }
            try { await pullNow(); } catch { }
        }
        setEditReturnId(null);
    };

    const deleteSale = async (id: string) => {
        await removeSale(id);
        if (online) {
            try { await pushNow(); } catch { }
            try { await pullNow(); } catch { }
        }
    };
    const deleteReturn = async (id: string) => {
        await removeReturn(id);
        if (online) {
            try { await pushNow(); } catch { }
            try { await pullNow(); } catch { }
        }
    };

    const renderSale = ({ item }: any) => {
        const amount = item.qty * item.price;
        const d = new Date(item.created_at);
        return (
            <Card style={{ marginTop: 8, padding: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    {/* chap: sana + nom + qty */}
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ color: C.muted, fontSize: 12 }}>
                            {d.toLocaleDateString()} {d.toLocaleTimeString()}
                        </Text>
                        <Text style={{ fontWeight: "800", color: C.text, marginTop: 2 }}>{item.productName}</Text>
                        <Text style={{ color: C.muted, marginTop: 2 }}>
                            Миқдор: {item.qty} {item.unit} × {item.price.toLocaleString()}
                        </Text>
                    </View>

                    {/* o‘ng: summa + tugmalar */}
                    <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontWeight: "800" }}>{amount.toLocaleString()} so‘m</Text>
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                            <TouchableOpacity
                                onPress={() => openSaleEdit(item.id, item.qty, item.price)}
                                style={{
                                    width: 36, height: 36, borderRadius: 18,
                                    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E9ECF1",
                                    alignItems: "center", justifyContent: "center",
                                }}
                            >
                                <Ionicons name="create-outline" size={18} color="#770E13" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => deleteSale(item.id)}
                                style={{
                                    width: 36, height: 36, borderRadius: 18,
                                    backgroundColor: "#FCE9EA", borderWidth: 1, borderColor: "#F4C7CB",
                                    alignItems: "center", justifyContent: "center",
                                }}
                            >
                                <Ionicons name="close-outline" size={18} color="#E23D3D" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Card>
        );
    };

    const renderReturn = ({ item }: any) => {
        const amount = item.qty * item.price;
        const d = new Date(item.created_at);
        return (
            <Card style={{ marginTop: 8, padding: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ color: C.muted, fontSize: 12 }}>
                            {d.toLocaleDateString()} {d.toLocaleTimeString()}
                        </Text>
                        <Text style={{ fontWeight: "800", color: C.text, marginTop: 2 }}>{item.productName}</Text>
                        <Text style={{ color: C.muted, marginTop: 2 }}>
                            Миқдор: {item.qty} {item.unit} × {item.price.toLocaleString()}
                        </Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontWeight: "800" }}>{amount.toLocaleString()} so‘m</Text>
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                            <TouchableOpacity
                                onPress={() => openReturnEdit(item.id, item.qty, item.price)}
                                style={{
                                    width: 36, height: 36, borderRadius: 18,
                                    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E9ECF1",
                                    alignItems: "center", justifyContent: "center",
                                }}
                            >
                                <Ionicons name="create-outline" size={18} color="#770E13" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => deleteReturn(item.id)}
                                style={{
                                    width: 36, height: 36, borderRadius: 18,
                                    backgroundColor: "#FCE9EA", borderWidth: 1, borderColor: "#F4C7CB",
                                    alignItems: "center", justifyContent: "center",
                                }}
                            >
                                <Ionicons name="close-outline" size={18} color="#E23D3D" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Card>
        );
    };

    return (
        <View style={{ flex: 1, padding: 16 }}>
            <H1>Тарих</H1>

            {/* Tablar */}
            <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                <TouchableOpacity onPress={() => setTab("sales")} style={{ flex: 1 }}>
                    <View
                        style={{
                            paddingVertical: 10,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: tab === "sales" ? C.primary : C.border,
                            backgroundColor: tab === "sales" ? C.primarySoft : C.white,
                            alignItems: "center",
                        }}
                    >
                        <Text style={{ fontWeight: "800", color: tab === "sales" ? C.primary : C.text }}>
                            Сотув тарихи
                        </Text>
                    </View>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setTab("returns")} style={{ flex: 1 }}>
                    <View
                        style={{
                            paddingVertical: 10,
                            borderRadius: 12,
                            borderWidth: 1,
                            borderColor: tab === "returns" ? C.primary : C.border,
                            backgroundColor: tab === "returns" ? C.primarySoft : C.white,
                            alignItems: "center",
                        }}
                    >
                        <Text style={{ fontWeight: "800", color: tab === "returns" ? C.primary : C.text }}>
                            Қайтариш тарихи
                        </Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Oy bo‘yicha filtr */}
            <View style={{ marginTop: 12 }}>
                <H2>Ой бўйича фильтр</H2>
                <Select value={month} onChange={setMonth} options={opts} style={{ marginTop: 6 }} />
            </View>

            {/* Listlar */}
            {tab === "sales" ? (
                sales.length === 0 ? (
                    <Text style={{ color: C.muted, marginTop: 10 }}>Ҳали маълумот йўқ</Text>
                ) : (
                    <FlatList
                        style={{ marginTop: 8 }}
                        data={sales}
                        keyExtractor={(i) => i.id}
                        renderItem={renderSale}
                        ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
                        contentContainerStyle={{ paddingBottom: 24 }}
                    />
                )
            ) : returns.length === 0 ? (
                <Text style={{ color: C.muted, marginTop: 10 }}>Ҳали маълумот йўқ</Text>
            ) : (
                <FlatList
                    style={{ marginTop: 8 }}
                    data={returns}
                    keyExtractor={(i) => i.id}
                    renderItem={renderReturn}
                    ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
                    contentContainerStyle={{ paddingBottom: 24 }}
                />
            )}

            {/* Edit modallar */}
            <Modal visible={!!editSaleId} transparent animationType="fade" onRequestClose={() => setEditSaleId(null)}>
                <Pressable onPress={() => setEditSaleId(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}>
                    <Card style={{ padding: 14 }}>
                        <H2>Сотувни таҳрирлаш</H2>
                        <Text style={{ marginTop: 8 }}>Миқдор</Text>
                        <TextInput value={qty} onChangeText={setQty} keyboardType="numeric" style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, marginTop: 4 }} />
                        <Text style={{ marginTop: 8 }}>Нарх</Text>
                        <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, marginTop: 4 }} />
                        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                            <Button title="Бекор" tone="neutral" onPress={() => setEditSaleId(null)} style={{ flex: 1 }} />
                            <Button title="Сақлаш" onPress={saveSale} style={{ flex: 1 }} />
                        </View>
                    </Card>
                </Pressable>
            </Modal>

            <Modal visible={!!editReturnId} transparent animationType="fade" onRequestClose={() => setEditReturnId(null)}>
                <Pressable onPress={() => setEditReturnId(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}>
                    <Card style={{ padding: 14 }}>
                        <H2>Қайтаришни таҳрирлаш</H2>
                        <Text style={{ marginTop: 8 }}>Миқдор</Text>
                        <TextInput value={qty} onChangeText={setQty} keyboardType="numeric" style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, marginTop: 4 }} />
                        <Text style={{ marginTop: 8 }}>Нарх</Text>
                        <TextInput value={price} onChangeText={setPrice} keyboardType="numeric" style={{ borderWidth: 1, borderColor: C.border, borderRadius: 10, padding: 10, marginTop: 4 }} />
                        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                            <Button title="Бекор" tone="neutral" onPress={() => setEditReturnId(null)} style={{ flex: 1 }} />
                            <Button title="Сақлаш" onPress={saveReturn} style={{ flex: 1 }} />
                        </View>
                    </Card>
                </Pressable>
            </Modal>
        </View>
    );
}
