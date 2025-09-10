// app/(main)/store/[id]/history.tsx
import { Button, C, Card, H1, H2, Select } from "@/components/UI";
import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from "react-native";

type Tab = "sales" | "returns";
type EditRow = { id: string; name: string; qty: string; price: string };

function monthOptions(lastN = 18) {
    const now = new Date();
    const arr: { label: string; value: string }[] = [];
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

type AnyRow = {
    id: string;
    storeId: string;
    created_at: number;
    batchId?: string;
    productName: string;
    qty: number;
    price: number;
    unit: "дона" | "кг";
};
type Group<T extends AnyRow> = { key: string; created: number; storeId: string; items: T[] };

function groupByBatch<T extends AnyRow>(rows: T[]): Group<T>[] {
    const map = new Map<string, T[]>();
    for (const r of rows) {
        const key = r.batchId ?? r.id;
        const arr = map.get(key) ?? [];
        arr.push(r);
        map.set(key, arr);
    }
    return Array.from(map.entries())
        .map(([key, items]) => ({ key, created: items[0]?.created_at ?? 0, storeId: items[0]?.storeId ?? "", items }))
        .sort((a, b) => b.created - a.created);
}

export default function History() {
    const stores = useAppStore((s) => s.stores);
    const salesAll = useAppStore((s) => s.sales) as AnyRow[];
    const returnsAll = useAppStore((s) => s.returns) as AnyRow[];

    const updateSale = useAppStore((s) => s.updateSale);
    const removeSale = useAppStore((s) => s.removeSale);
    const updateReturn = useAppStore((s) => s.updateReturn);
    const removeReturn = useAppStore((s) => s.removeReturn);

    const online = useSyncStore((s) => s.online);
    const pushNow = useAppStore((s) => s.pushNow);
    const pullNow = useAppStore((s) => s.pullNow);

    const [tab, setTab] = useState<Tab>("sales");
    const monthOpts = useMemo(() => monthOptions(18), []);
    const [month, setMonth] = useState(monthOpts[0]?.value);

    type StoreTypeFilter = "all" | "branch" | "market";
    const [storeType, setStoreType] = useState<StoreTypeFilter>("all");

    const filteredStores = useMemo(
        () => stores.filter((s) => (storeType === "all" ? true : s.type === storeType)),
        [stores, storeType]
    );
    const storeOptions = useMemo(
        () => [{ label: "Барчаси", value: "all" }, ...filteredStores.map((s) => ({ label: s.name, value: s.id }))],
        [filteredStores]
    );
    const [storeId, setStoreId] = useState<string>("all");

    const salesFiltered = useMemo(() => {
        return salesAll
            .filter((x) => (!month || inSameMonth(x.created_at, month)))
            .filter((x) => {
                if (storeId !== "all") return x.storeId === storeId;
                if (storeType === "all") return true;
                const st = stores.find((s) => s.id === x.storeId)?.type;
                return st === storeType;
            })
            .sort((a, b) => b.created_at - a.created_at);
    }, [salesAll, month, storeId, storeType, stores]);

    const returnsFiltered = useMemo(() => {
        return returnsAll
            .filter((x) => (!month || inSameMonth(x.created_at, month)))
            .filter((x) => {
                if (storeId !== "all") return x.storeId === storeId;
                if (storeType === "all") return true;
                const st = stores.find((s) => s.id === x.storeId)?.type;
                return st === storeType;
            })
            .sort((a, b) => b.created_at - a.created_at);
    }, [returnsAll, month, storeId, storeType, stores]);

    const saleGroups = useMemo(() => groupByBatch(salesFiltered), [salesFiltered]);
    const returnGroups = useMemo(() => groupByBatch(returnsFiltered), [returnsFiltered]);

    const [editType, setEditType] = useState<Tab | null>(null);
    const [openKey, setOpenKey] = useState<string | null>(null);
    const [editRows, setEditRows] = useState<EditRow[]>([]);

    const openGroupEdit = (type: Tab, key: string) => {
        setEditType(type);
        setOpenKey(key);
        const g = type === "sales" ? saleGroups.find((x) => x.key === key) : returnGroups.find((x) => x.key === key);
        const rows: EditRow[] =
            g?.items.map((x) => ({ id: x.id, name: x.productName, qty: String(x.qty), price: String(x.price) })) ?? [];
        setEditRows(rows);
    };

    const saveGroup = async () => {
        for (const r of editRows) {
            const qty = Number(r.qty || "0");
            const price = Number(r.price || "0");
            if (editType === "sales") await updateSale(r.id, { qty, price });
            else if (editType === "returns") await updateReturn(r.id, { qty, price });
        }
        if (online) {
            try { await pushNow(); } catch { }
            try { await pullNow(); } catch { }
        }
        setOpenKey(null);
        setEditType(null);
    };

    const removeRowFromGroup = async (rowId: string) => {
        if (editType === "sales") await removeSale(rowId);
        else if (editType === "returns") await removeReturn(rowId);
        setEditRows((rows) => rows.filter((r) => r.id !== rowId));
        if (online) {
            try { await pushNow(); } catch { }
            try { await pullNow(); } catch { }
        }
    };

    const removeWholeGroup = async (type: Tab, key: string) => {
        const g = type === "sales" ? saleGroups.find((x) => x.key === key) : returnGroups.find((x) => x.key === key);
        if (!g) return;
        for (const row of g.items) {
            if (type === "sales") await removeSale(row.id);
            else await removeReturn(row.id);
        }
        if (online) {
            try { await pushNow(); } catch { }
            try { await pullNow(); } catch { }
        }
    };

    const money = (n: number) => (n || 0).toLocaleString() + " so‘m";
    const getStoreName = (sid: string) => stores.find((s) => s.id === sid)?.name ?? "—";

    const GroupCard = ({ g, type }: { g: Group<AnyRow>; type: Tab }) => {
        const total = g.items.reduce((a: number, r: AnyRow) => a + r.qty * r.price, 0);
        const d = new Date(g.created);
        const preview = g.items.slice(0, 2);
        const storeName = getStoreName(g.storeId);

        return (
            <Card style={{ marginTop: 8, padding: 12 }}>
                <View style={{ flexDirection: "row", alignItems: "center" }}>
                    <View style={{ flex: 1, paddingRight: 10 }}>
                        <Text style={{ fontWeight: "800", color: C.text }}>{storeName}</Text>
                        <Text style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>
                            {d.toLocaleDateString()} {d.toLocaleTimeString()}
                        </Text>
                        {preview.map((r) => (
                            <Text key={r.id} style={{ color: C.text, marginTop: 2 }}>
                                {r.productName} · {r.qty} {r.unit} × {r.price.toLocaleString()}
                            </Text>
                        ))}
                        {g.items.length > preview.length && (
                            <Text style={{ color: C.muted, marginTop: 2 }}>+ {g.items.length - preview.length} ta qator</Text>
                        )}
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                        <Text style={{ fontWeight: "800" }}>{money(total)}</Text>
                        <View style={{ flexDirection: "row", gap: 8, marginTop: 8 }}>
                            <TouchableOpacity
                                onPress={() => openGroupEdit(type, g.key)}
                                style={{
                                    width: 36, height: 36, borderRadius: 18,
                                    backgroundColor: "#fff", borderWidth: 1, borderColor: "#E9ECF1",
                                    alignItems: "center", justifyContent: "center",
                                }}
                            >
                                <Ionicons name="create-outline" size={18} color="#770E13" />
                            </TouchableOpacity>
                            <TouchableOpacity
                                onPress={() => removeWholeGroup(type, g.key)}
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
                        <Text style={{ fontWeight: "800", color: tab === "sales" ? C.primary : C.text }}>Сотув тарихи</Text>
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
                        <Text style={{ fontWeight: "800", color: tab === "returns" ? C.primary : C.text }}>Қайтариш тарихи</Text>
                    </View>
                </TouchableOpacity>
            </View>

            {/* Filtrlar */}
            <View style={{ marginTop: 12 }}>
                <H2>Ой бўйича фильтр</H2>
                <Select value={month} onChange={setMonth} options={monthOpts} style={{ marginTop: 6 }} />
            </View>

            {/* 50/50 qatorda Turi + Filial/Do‘kon */}
            <View style={{ marginTop: 12, flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                    <H2>Тури</H2>
                    <Select
                        value={storeType}
                        onChange={(v: string) => {
                            setStoreType(v as StoreTypeFilter);
                            setStoreId("all");
                        }}
                        options={[
                            { label: "Барчаси", value: "all" },
                            { label: "Филиаллар", value: "branch" },
                            { label: "Дўконлар", value: "market" },
                        ]}
                        style={{ marginTop: 6 }}
                    />
                </View>
                <View style={{ flex: 1 }}>
                    <H2>Филиал/Дўкон</H2>
                    <Select value={storeId} onChange={setStoreId} options={storeOptions} style={{ marginTop: 6 }} />
                </View>
            </View>

            {/* Ro'yxatlar */}
            {tab === "sales" ? (
                saleGroups.length === 0 ? (
                    <Text style={{ color: C.muted, marginTop: 10 }}>Ҳали маълумот йўқ</Text>
                ) : (
                    <FlatList
                        style={{ marginTop: 8 }}
                        data={saleGroups}
                        keyExtractor={(g) => g.key}
                        renderItem={({ item }) => <GroupCard g={item} type="sales" />}
                        ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
                        contentContainerStyle={{ paddingBottom: 24 }}
                    />
                )
            ) : returnGroups.length === 0 ? (
                <Text style={{ color: C.muted, marginTop: 10 }}>Ҳали маълумот йўқ</Text>
            ) : (
                <FlatList
                    style={{ marginTop: 8 }}
                    data={returnGroups}
                    keyExtractor={(g) => g.key}
                    renderItem={({ item }) => <GroupCard g={item} type="returns" />}
                    ItemSeparatorComponent={() => <View style={{ height: 4 }} />}
                    contentContainerStyle={{ paddingBottom: 24 }}
                />
            )}

            {/* Paket edit modali */}
            <Modal
                visible={!!openKey}
                transparent
                animationType="fade"
                onRequestClose={() => {
                    setOpenKey(null);
                    setEditType(null);
                }}
            >
                <Pressable
                    onPress={() => {
                        setOpenKey(null);
                        setEditType(null);
                    }}
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}
                >
                    <Card style={{ padding: 14, maxHeight: "80%" }}>
                        <H2>{editType === "sales" ? "Сотувни" : "Қайтаришни"} пакет билан таҳрирлаш</H2>

                        <FlatList
                            style={{ marginTop: 10 }}
                            data={editRows}
                            keyExtractor={(r) => r.id}
                            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                            renderItem={({ item }) => (
                                <View style={{ borderWidth: 1, borderColor: "#EEE", borderRadius: 10, padding: 10 }}>
                                    <Text style={{ fontWeight: "800" }}>{item.name}</Text>

                                    <View style={{ flexDirection: "row", gap: 8, marginTop: 6 }}>
                                        <TextInput
                                            value={item.qty}
                                            onChangeText={(v) =>
                                                setEditRows((rows) => rows.map((r) => (r.id === item.id ? { ...r, qty: v } : r)))
                                            }
                                            keyboardType="numeric"
                                            placeholder="Миқдор"
                                            style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10 }}
                                        />
                                        <TextInput
                                            value={item.price}
                                            onChangeText={(v) =>
                                                setEditRows((rows) => rows.map((r) => (r.id === item.id ? { ...r, price: v } : r)))
                                            }
                                            keyboardType="numeric"
                                            placeholder="Нарх"
                                            style={{ flex: 1, borderWidth: 1, borderColor: C.border, borderRadius: 8, padding: 10 }}
                                        />
                                        <TouchableOpacity
                                            onPress={() => removeRowFromGroup(item.id)}
                                            style={{
                                                width: 36, height: 36, borderRadius: 18,
                                                backgroundColor: "#FCE9EA", borderWidth: 1, borderColor: "#F4C7CB",
                                                alignItems: "center", justifyContent: "center", alignSelf: "center",
                                            }}
                                        >
                                            <Ionicons name="close-outline" size={18} color="#E23D3D" />
                                        </TouchableOpacity>
                                    </View>
                                </View>
                            )}
                        />

                        <View style={{ flexDirection: "row", gap: 10, marginTop: 12, justifyContent: "flex-end" }}>
                            <Button title="Бекор" tone="neutral" onPress={() => { setOpenKey(null); setEditType(null); }} style={{ minWidth: 120 }} />
                            <Button title="Сақлаш" onPress={saveGroup} style={{ minWidth: 120 }} />
                        </View>
                    </Card>
                </Pressable>
            </Modal>
        </View>
    );
}
