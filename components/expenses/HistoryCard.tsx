// components/expenses/HistoryCard.tsx
import type { ExpenseBatch } from "@/store/expensesStore";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

export default function HistoryCard({
    batch, onEdit, onDelete,
}: {
    batch: ExpenseBatch;
    onEdit: (b: ExpenseBatch) => void;
    onDelete: (b: ExpenseBatch) => void;
}) {
    const dt = new Date(batch.created_at);
    return (
        <View style={styles.card}>
            <View style={styles.head}>
                <Text style={styles.date}>
                    {dt.toLocaleDateString()} • {dt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </Text>
                <View style={{ flexDirection: "row", gap: 10 }}>
                    <TouchableOpacity onPress={() => onEdit(batch)} style={styles.iconBtn} accessibilityLabel="Edit">
                        <Ionicons name="create-outline" size={18} color="#333" />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => onDelete(batch)} style={styles.iconBtn} accessibilityLabel="Delete">
                        <Ionicons name="trash-outline" size={18} color="#770E13" />
                    </TouchableOpacity>
                </View>
            </View>

            {batch.items.map((it) => (
                <View key={it.id} style={styles.item}>
                    <Text style={styles.itemTitle}>{it.title}</Text>
                    <Text style={styles.itemAmt}>
                        {(Number(it.qty ?? 0)).toLocaleString()} × {(Number(it.price ?? 0)).toLocaleString()} ={" "}
                        <Text style={{ fontWeight: "800" }}>{Number(it.amount).toLocaleString()}</Text>
                    </Text>
                </View>
            ))}

            <View style={styles.sep} />
            <Text style={styles.total}>Jami: {Number(batch.total).toLocaleString()} so‘m</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee",
        borderRadius: 14, padding: 12, marginHorizontal: 12, marginBottom: 12,
    },
    head: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 8 },
    date: { color: "#666" },
    iconBtn: { padding: 6, borderRadius: 8, backgroundColor: "#f5f5f7", borderWidth: 1, borderColor: "#eee" },
    item: { marginVertical: 4 },
    itemTitle: { fontWeight: "600", color: "#222" },
    itemAmt: { color: "#444" },
    sep: { height: 1, backgroundColor: "#f0f0f0", marginVertical: 8 },
    total: { fontWeight: "800", color: "#222" },
});
