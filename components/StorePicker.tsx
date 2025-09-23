// components/StorePicker.tsx
import { useAppStore } from "@/store/appStore";
import React, { useMemo, useState } from "react";
import { FlatList, Modal, Pressable, Text, TextInput, TouchableOpacity, View } from "react-native";

type Props = {
    compact?: boolean;
    onPicked?: (id: string) => void;
};

export default function StorePicker({ compact = false, onPicked }: Props) {
    const stores = useAppStore((s) => s.stores);
    const currentStoreId = useAppStore((s) => s.currentStoreId);
    const setCurrentStore = useAppStore((s) => s.setCurrentStore);

    const [open, setOpen] = useState(false);
    const [q, setQ] = useState("");

    const list = useMemo(() => {
        const t = q.trim().toLowerCase();
        if (!t) return stores;
        return stores.filter((s) => (s.name || "").toLowerCase().includes(t));
    }, [stores, q]);

    const currentName = useMemo(
        () => stores.find((s) => String(s.id) === String(currentStoreId))?.name ?? "Филиал/Дўкон танланг",
        [stores, currentStoreId]
    );

    const pick = (id: string) => {
        setOpen(false);
        setCurrentStore(id);
        onPicked?.(id);
    };

    return (
        <View>
            <TouchableOpacity
                onPress={() => setOpen(true)}
                style={{
                    borderWidth: 1,
                    borderColor: "#E9ECF1",
                    borderRadius: 12,
                    padding: compact ? 10 : 12,
                    backgroundColor: "#fff",
                }}
            >
                <Text style={{ fontWeight: "700" }}>{currentName}</Text>
            </TouchableOpacity>

            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable
                    onPress={() => setOpen(false)}
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}
                >
                    <View style={{ backgroundColor: "#fff", borderRadius: 12, overflow: "hidden", maxHeight: "70%" }}>
                        <View style={{ padding: 12, borderBottomWidth: 1, borderColor: "#eee" }}>
                            <TextInput
                                placeholder="Қидирув…"
                                value={q}
                                onChangeText={setQ}
                                style={{ borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 10, padding: 10 }}
                            />
                        </View>
                        <FlatList
                            data={list}
                            keyExtractor={(s) => String(s.id)}
                            renderItem={({ item }) => (
                                <TouchableOpacity onPress={() => pick(String(item.id))} style={{ padding: 14, borderBottomWidth: 1, borderColor: "#F3F4F6" }}>
                                    <Text style={{ fontWeight: "700" }}>{item.name}</Text>
                                    <Text style={{ color: "#6B7280", marginTop: 2 }}>{item.type === "branch" ? "Filial" : "Do‘kon"}</Text>
                                </TouchableOpacity>
                            )}
                        />
                    </View>
                </Pressable>
            </Modal>
        </View>
    );
}
