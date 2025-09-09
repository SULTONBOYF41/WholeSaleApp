import { C, Card, H1, Select } from "@/components/UI";
import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import { useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from "react-native";

type Tab = "sales" | "returns";
type MonthOpt = { label: string; value: string };

function monthRange(ym: string) {
    const [y, m] = ym.split("-").map(Number);
    const start = new Date(y, m - 1, 1).getTime();
    const end = new Date(y, m, 1).getTime() - 1;
    return { start, end };
}
const money = (n: number) => `${Math.round(n).toLocaleString()} so‘m`;

export default function History() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const online = useSyncStore((s) => s.online);

    const allSales = useAppStore((s) => s.sales);
    const allReturns = useAppStore((s) => s.returns);
    const startPull = useAppStore((s) => s.startPull);

    const updateSale = useAppStore((s) => (s as any).updateSale);
    const removeSale = useAppStore((s) => (s as any).removeSale);
    const updateReturn = useAppStore((s) => (s as any).updateReturn);
    const removeReturn = useAppStore((s) => (s as any).removeReturn);

    const [tab, setTab] = useState<Tab>("sales");

    const now = new Date();
    const defaultYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [ym, setYm] = useState(defaultYM);
    const { start, end } = monthRange(ym);

    const months: MonthOpt[] = useMemo(() => {
        const arr: MonthOpt[] = [];
        const names = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
        const d = new Date();
        for (let i = 0; i < 18; i++) {
            const y = d.getFullYear(), m = d.getMonth() + 1;
            arr.push({ value: `${y}-${String(m).padStart(2, "0")}`, label: `${names[m - 1]} ${y}` });
            d.setMonth(d.getMonth() - 1);
        }
        return arr;
    }, []);

    const sales = useMemo(
        () => allSales.filter((x) => x.storeId === id && x.created_at >= start && x.created_at <= end),
        [allSales, id, start, end]
    );
    const returns = useMemo(
        () => allReturns.filter((x) => x.storeId === id && x.created_at >= start && x.created_at <= end),
        [allReturns, id, start, end]
    );

    const [editOpen, setEditOpen] = useState<{ type: Tab; id: string; qty: string; price: string } | null>(null);

    useEffect(() => {
        startPull().catch(() => { });
    }, [startPull]);

    const onEdit = (type: Tab, item: any) => {
        setEditOpen({ type, id: item.id, qty: String(item.qty), price: String(item.price) });
    };
    const onDelete = async (type: Tab, id: string) => {
        if (type === "sales") {
            if (typeof removeSale === "function") await removeSale(id);
        } else {
            if (typeof removeReturn === "function") await removeReturn(id);
        }
        if (online) {
            try { await useAppStore.getState().pushNow(); } catch { }
            try { await useAppStore.getState().pullNow(); } catch { }
        }
    };
    const applyEdit = async () => {
        if (!editOpen) return;
        const qty = Number(editOpen.qty || "0");
        const price = Number(editOpen.price || "0");
        if (!qty || !price) { setEditOpen(null); return; }
        if (editOpen.type === "sales") {
            if (typeof updateSale === "function") await updateSale(editOpen.id, { qty, price });
        } else {
            if (typeof updateReturn === "function") await updateReturn(editOpen.id, { qty, price });
        }
        if (online) {
            try { await useAppStore.getState().pushNow(); } catch { }
            try { await useAppStore.getState().pullNow(); } catch { }
        }
        setEditOpen(null);
    };

    return (
        <View style={{ flex: 1, padding: 16 }}>
            <H1>Тарих</H1>

            {/* Tabs */}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                    onPress={() => setTab("sales")}
                    style={{
                        flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.primary,
                        backgroundColor: tab === "sales" ? C.primary : "#fff", alignItems: "center",
                    }}
                >
                    <Text style={{ fontWeight: "800", color: tab === "sales" ? "#fff" : C.primary }}>Sotuv tarixi</Text>
                </TouchableOpacity>
                <TouchableOpacity
                    onPress={() => setTab("returns")}
                    style={{
                        flex: 1, paddingVertical: 12, borderRadius: 12, borderWidth: 1, borderColor: C.primary,
                        backgroundColor: tab === "returns" ? C.primary : "#fff", alignItems: "center",
                    }}
                >
                    <Text style={{ fontWeight: "800", color: tab === "returns" ? "#fff" : C.primary }}>Vazvrat tarixi</Text>
                </TouchableOpacity>
            </View>

            {/* Oy filtr */}
            <View style={{ marginTop: 10 }}>
                <Select value={ym} onChange={setYm} options={months} placeholder="Ойни танланг" />
            </View>

            <FlatList
                style={{ marginTop: 12 }}
                data={(tab === "sales" ? sales : returns).slice().reverse()}
                keyExtractor={(i) => i.id}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                renderItem={({ item }) => {
                    const line = `${item.qty} ${item.unit} × ${item.price.toLocaleString()} so‘m = ${(item.qty * item.price).toLocaleString()} so‘m`;
                    return (
                        <Card style={{ padding: 12 }}>
                            <View style={{ flexDirection: "row" }}>
                                {/* CHAP TOMON: vaqt → nomi → miqdor+summa */}
                                <View style={{ flex: 1, paddingRight: 8 }}>
                                    <Text style={{ fontWeight: "700" }}>{new Date(item.created_at).toLocaleString()}</Text>
                                    <Text style={{ color: "#555", marginTop: 2 }}>{item.productName}</Text>
                                    <Text style={{ marginTop: 6 }}>{line}</Text>
                                </View>

                                {/* O‘NG TOMON: faqat tugmalar */}
                                <View style={{ alignItems: "flex-end", justifyContent: "flex-start", gap: 8 }}>
                                    <TouchableOpacity
                                        onPress={() => onEdit(tab, item)}
                                        style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, borderWidth: 1, borderColor: C.border, backgroundColor: "#fff" }}
                                    >
                                        <Text style={{ fontWeight: "700" }}>Ред.</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        onPress={() => onDelete(tab, item.id)}
                                        style={{ paddingVertical: 6, paddingHorizontal: 10, borderRadius: 8, backgroundColor: "#E23D3D" }}
                                    >
                                        <Text style={{ color: "#fff", fontWeight: "800" }}>Удал.</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Card>
                    );
                }}
                ListEmptyComponent={<View style={{ marginTop: 20 }}><Text style={{ color: "#777" }}>Ma’lumot yo‘q</Text></View>}
            />

            {/* Edit modal */}
            <Modal visible={!!editOpen} transparent animationType="fade" onRequestClose={() => setEditOpen(null)}>
                <Pressable onPress={() => setEditOpen(null)} style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}>
                    <View style={{ backgroundColor: "#fff", borderRadius: 12, padding: 16 }}>
                        <Text style={{ fontWeight: "800", marginBottom: 8 }}>Таҳрирлаш</Text>
                        <View style={{ flexDirection: "row", gap: 8 }}>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: C.muted, marginBottom: 4 }}>Миқдор</Text>
                                <TextInput
                                    placeholder="0"
                                    value={editOpen?.qty ?? ""}
                                    onChangeText={(v) => setEditOpen((st) => (st ? { ...st, qty: v } : st))}
                                    keyboardType="numeric"
                                    style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 10 }}
                                />
                            </View>
                            <View style={{ flex: 1 }}>
                                <Text style={{ color: C.muted, marginBottom: 4 }}>Нарх</Text>
                                <TextInput
                                    placeholder="0"
                                    value={editOpen?.price ?? ""}
                                    onChangeText={(v) => setEditOpen((st) => (st ? { ...st, price: v } : st))}
                                    keyboardType="numeric"
                                    style={{ borderWidth: 1, borderColor: "#ddd", borderRadius: 10, padding: 10 }}
                                />
                            </View>
                        </View>
                        <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                            <TouchableOpacity onPress={applyEdit} style={{ backgroundColor: C.primary, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 10 }}>
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
