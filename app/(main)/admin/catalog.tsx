import { Button, Card, Chip, H1, H2, Input } from "@/components/UI";
import { useAppStore } from "@/store/appStore";
import type { Product } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Alert, FlatList, Text, TouchableOpacity, View } from "react-native";

type Target = "branch" | "market" | "both";

const PRIMARY = "#770E13";
const CREAM = "#F6EAD4";

export default function Catalog() {
    const products = useAppStore((s) => s.products);
    const upsertProduct = useAppStore((s) => s.upsertProduct);
    const removeProduct = useAppStore((s) => s.removeProduct);

    const [name, setName] = useState("");
    const [target, setTarget] = useState<Target>("branch");
    const [price, setPrice] = useState("");
    const [priceBranch, setPriceBranch] = useState("");
    const [priceMarket, setPriceMarket] = useState("");
    const [editing, setEditing] = useState<Product | null>(null);

    const resetForm = () => {
        setName("");
        setTarget("branch");
        setPrice("");
        setPriceBranch("");
        setPriceMarket("");
        setEditing(null);
    };

    const submit = async () => {
        if (!name.trim()) return;
        try {
            if (target === "both") {
                const pb = priceBranch ? +priceBranch : undefined;
                const pm = priceMarket ? +priceMarket : undefined;
                if (editing) {
                    await upsertProduct({
                        id: editing.id,
                        name: name.trim(),
                        priceBranch: pb ?? editing.priceBranch,
                        priceMarket: pm ?? editing.priceMarket,
                    });
                } else {
                    await upsertProduct({ name: name.trim(), priceBranch: pb, priceMarket: pm });
                }
            } else {
                const v = price ? +price : undefined;
                if (editing) {
                    await upsertProduct({
                        id: editing.id,
                        name: name.trim(),
                        priceBranch: target === "branch" ? (v ?? editing.priceBranch) : editing.priceBranch,
                        priceMarket: target === "market" ? (v ?? editing.priceMarket) : editing.priceMarket,
                    });
                } else {
                    await upsertProduct({
                        name: name.trim(),
                        priceBranch: target === "branch" ? v : undefined,
                        priceMarket: target === "market" ? v : undefined,
                    });
                }
            }
        } finally {
            resetForm();
        }
    };

    const startEdit = (p: Product) => {
        setEditing(p);
        setName(p.name);
        setTarget("branch");
        setPrice("");
        setPriceBranch("");
        setPriceMarket("");
    };

    const Header = useMemo(
        () => (
            <View style={{ padding: 16, gap: 10 }}>
                <H1 style={{ color: PRIMARY }}>Каталог</H1>

                <H2 style={{ marginTop: 6 }}>Категория номи</H2>
                <Input value={name} onChangeText={setName} placeholder="" />

                <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                    <TouchableOpacity onPress={() => setTarget("branch")} style={{ flex: 1 }}>
                        <Chip active={target === "branch"} label="Филиал учун" style={{ alignItems: "center" }} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setTarget("market")} style={{ flex: 1 }}>
                        <Chip active={target === "market"} label="Дўкон учун" style={{ alignItems: "center" }} />
                    </TouchableOpacity>
                </View>

                <TouchableOpacity onPress={() => setTarget("both")}>
                    <Chip active={target === "both"} label="Иккаласи учун ҳам" style={{ marginTop: 6, alignSelf: "stretch" }} />
                </TouchableOpacity>

                {target === "both" ? (
                    <View style={{ flexDirection: "row", gap: 10, marginTop: 6 }}>
                        <View style={{ flex: 1 }}>
                            <H2>Филиал нархи</H2>
                            <Input value={priceBranch} onChangeText={setPriceBranch} keyboardType="numeric" />
                        </View>
                        <View style={{ flex: 1 }}>
                            <H2>Дўкон нархи</H2>
                            <Input value={priceMarket} onChangeText={setPriceMarket} keyboardType="numeric" />
                        </View>
                    </View>
                ) : (
                    <>
                        <H2 style={{ marginTop: 6 }}>Нарх</H2>
                        <Input value={price} onChangeText={setPrice} keyboardType="numeric" />
                    </>
                )}

                <Button
                    onPress={submit}
                    title={editing ? "Сақлаш" : "Қўшиш"}
                    style={{ marginTop: 8, backgroundColor: PRIMARY }}
                // agar UI.Button textStyle prop yo‘q bo‘lsa, quyidagi qatorni olib tashlang:
                // textStyle={{ color: CREAM, fontWeight: "800" }}
                />

                <H2 style={{ marginTop: 10 }}>Категориялар</H2>
            </View>
        ),
        [name, target, price, priceBranch, priceMarket, editing]
    );

    return (
        <FlatList
            data={[...products].sort((a, b) => a.name.localeCompare(b.name))}
            keyExtractor={(i) => i.id}
            ListHeaderComponent={Header}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
            renderItem={({ item }) => (
                <Card style={{ padding: 12 }}>
                    <View style={{ flexDirection: "row", alignItems: "center" }}>
                        {/* Chap: nom + narxlar */}
                        <View style={{ flex: 1, paddingRight: 10 }}>
                            <Text style={{ fontWeight: "800", color: "#222" }}>{item.name}</Text>
                            <Text style={{ color: "#666", marginTop: 4 }}>
                                Филиал: {item.priceBranch ?? 0} · Дўкон: {item.priceMarket ?? 0}
                            </Text>
                        </View>

                        {/* O‘ng: ikon tugmalar (Qalam = Red, X = Udl) */}
                        <View style={{ flexDirection: "row", gap: 10 }}>
                            {/* Red (edit) */}
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
                                accessibilityLabel="Red"
                            >
                                <Ionicons name="create-outline" size={20} color={PRIMARY} />
                            </TouchableOpacity>

                            {/* Udl (delete) */}
                            <TouchableOpacity
                                onPress={() =>
                                    Alert.alert("Олиб ташлаш", "Ростдан ҳам ўчирилсинми?", [
                                        { text: "Бекор" },
                                        { text: "Ҳа", style: "destructive", onPress: () => removeProduct(item.id) },
                                    ])
                                }
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
                                accessibilityLabel="Udl"
                            >
                                <Ionicons name="close-outline" size={20} color="#E23D3D" />
                            </TouchableOpacity>
                        </View>
                    </View>
                </Card>
            )}
        />
    );
}
