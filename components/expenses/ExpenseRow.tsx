// components/expenses/ExpenseRow.tsx
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

export type ExpenseRowValue = { title: string; qty: string; price: string; note?: string };

export default function ExpenseRow({
    value, onChange, onRemove,
    titlePlaceholder = "Mahsulot / Izoh",
}: {
    value: ExpenseRowValue;
    onChange: (v: ExpenseRowValue) => void;
    onRemove: () => void;
    titlePlaceholder?: string;
}) {
    const qty = Number(value.qty || 0);
    const price = Number(value.price || 0);
    const lineSum = qty * price;

    return (
        <View style={styles.card}>
            <TextInput
                placeholder={titlePlaceholder}
                value={value.title}
                onChangeText={(t) => onChange({ ...value, title: t })}
                style={styles.titleInput}
            />

            <View style={styles.row}>
                <View style={styles.inputsBox}>
                    <TextInput
                        placeholder="Miqdor"
                        keyboardType="numeric"
                        value={value.qty}
                        onChangeText={(t) => onChange({ ...value, qty: t })}
                        style={[styles.input, { flex: 1 }]}
                    />
                    <TextInput
                        placeholder="Narx"
                        keyboardType="numeric"
                        value={value.price}
                        onChangeText={(t) => onChange({ ...value, price: t })}
                        style={[styles.input, { flex: 1 }]}
                    />
                </View>

                <TouchableOpacity onPress={onRemove} style={styles.minusBtn}>
                    <Ionicons name="remove" size={18} color="#770E13" />
                </TouchableOpacity>
            </View>

            <Text style={styles.sumText}>Summa: {Number(lineSum || 0).toLocaleString()} so‘m</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        backgroundColor: "#fff",
        marginHorizontal: 12,
        marginBottom: 12,
        padding: 12,
        borderRadius: 14,
        borderWidth: 1, borderColor: "#eee",
    },
    titleInput: {
        backgroundColor: "#f9f9fb",
        borderWidth: 1, borderColor: "#e8e8ef",
        paddingHorizontal: 12, paddingVertical: 12,
        borderRadius: 12, marginBottom: 12,
    },
    row: { flexDirection: "row", alignItems: "center", gap: 10 },
    inputsBox: {
        flex: 1,
        borderWidth: 1, borderColor: "#222", borderRadius: 12,
        padding: 8, flexDirection: "row", gap: 8,
    },
    input: {
        backgroundColor: "#fff",
        borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10,
    },
    minusBtn: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: "#FCE9EA", borderWidth: 1, borderColor: "#F4C7CB",
        alignItems: "center", justifyContent: "center",
    },
    sumText: { marginTop: 8, fontWeight: "600", color: "#222" },
});
