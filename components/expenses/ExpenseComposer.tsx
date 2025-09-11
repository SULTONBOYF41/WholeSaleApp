// components/expenses/ExpenseComposer.tsx
import { ExpenseBatch, ExpenseKind, RowInput, useExpensesStore } from "@/store/expensesStore";
import React, { useMemo, useState } from "react";
import { ActivityIndicator, Modal, ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import ExpenseRow, { ExpenseRowValue } from "./ExpenseRow";
import HistoryCard from "./HistoryCard";

export default function ExpenseComposer({ kind }: { kind: ExpenseKind }) {
    const { addBatch, editBatch, deleteBatch, listBatches } = useExpensesStore();
    const [rows, setRows] = useState<ExpenseRowValue[]>([{ title: "", qty: "", price: "" }]);
    const [showHistory, setShowHistory] = useState(false);
    const [editingBatch, setEditingBatch] = useState<ExpenseBatch | null>(null);
    const [saving, setSaving] = useState(false);
    const [savedBanner, setSavedBanner] = useState(false);

    const titlePlaceholder = useMemo(() => "Mahsulot / Izoh", []);
    const addRow = () => setRows(r => [...r, { title: "", qty: "", price: "" }]);
    const removeRow = (i: number) => setRows(r => r.filter((_, idx) => idx !== i));

    const normalize = (): RowInput[] =>
        rows
            .map(r => ({ title: r.title.trim(), qty: Number(r.qty || 0), price: Number(r.price || 0) }))
            .filter(r => r.title && r.qty > 0 && r.price > 0);

    const total = normalize().reduce((s, r) => s + r.qty * r.price, 0);

    const onSave = async () => {
        const n = normalize();
        if (!n.length) return;
        setSaving(true);
        try {
            if (editingBatch) {
                await editBatch(editingBatch.id, kind, n);
                setEditingBatch(null);
            } else {
                await addBatch(kind, n);
            }
            setRows([{ title: "", qty: "", price: "" }]);
            // little “Saved!” banner
            setSavedBanner(true);
            setTimeout(() => setSavedBanner(false), 1500);
        } finally {
            setSaving(false);
        }
    };

    const onEdit = (b: ExpenseBatch) => {
        setEditingBatch(b);
        setRows(
            b.items.map(i => ({
                title: i.title,
                qty: String(i.qty ?? 1),
                price: String(i.price ?? Number(i.amount)),
            }))
        );
        if (!showHistory) setShowHistory(true);
    };

    const onDelete = async (b: ExpenseBatch) => {
        setSaving(true);
        try {
            await deleteBatch(b.id);
            if (editingBatch?.id === b.id) {
                setEditingBatch(null);
                setRows([{ title: "", qty: "", price: "" }]);
            }
        } finally {
            setSaving(false);
        }
    };

    const history = listBatches(kind);

    return (
        <View style={{ flex: 1 }}>
            {/* Saved banner */}
            {savedBanner && (
                <View style={styles.banner}>
                    <Text style={styles.bannerText}>Saqlandi ✓</Text>
                </View>
            )}

            <ScrollView contentContainerStyle={{ paddingVertical: 12 }}>
                {rows.map((row, idx) => (
                    <ExpenseRow
                        key={idx}
                        value={row}
                        titlePlaceholder={titlePlaceholder}
                        onChange={(v) => setRows(prev => prev.map((p, i) => (i === idx ? v : p)))}
                        onRemove={() => removeRow(idx)}
                    />
                ))}

                <View style={styles.actions}>
                    <TouchableOpacity onPress={addRow} style={styles.addBtn}>
                        <Text style={styles.addBtnText}>Qator qo‘shish</Text>
                    </TouchableOpacity>
                    <View style={{ flex: 1 }} />
                    <View style={styles.totalBox}>
                        <Text style={styles.totalLabel}>Umumiy summa:</Text>
                        <Text style={styles.totalVal}>{Number(total).toLocaleString()} so‘m</Text>
                    </View>
                </View>

                {editingBatch && (
                    <View style={styles.editingTag}>
                        <Text style={{ color: "#770E13", fontWeight: "800" }}>Tahrirlash rejimi</Text>
                    </View>
                )}

                <TouchableOpacity onPress={onSave} style={styles.saveBtn}>
                    <Text style={styles.saveBtnText}>{editingBatch ? "O‘zgartirishni saqlash" : "Saqlash"}</Text>
                </TouchableOpacity>

                <View style={{ height: 10 }} />
                <TouchableOpacity onPress={() => setShowHistory(s => !s)} style={styles.historyBtn}>
                    <Text style={styles.historyText}>{showHistory ? "Tarixni yopish" : "Tarixni ko‘rish"}</Text>
                </TouchableOpacity>

                {showHistory && (
                    <View style={{ paddingTop: 8 }}>
                        {history.map((b) => (
                            <HistoryCard key={b.id} batch={b} onEdit={onEdit} onDelete={onDelete} />
                        ))}
                    </View>
                )}

                <View style={{ height: 24 }} />
            </ScrollView>

            {/* Saving modal */}
            <Modal visible={saving} transparent animationType="fade">
                <View style={styles.modalWrap}>
                    <View style={styles.modalCard}>
                        <ActivityIndicator size="large" />
                        <Text style={{ marginTop: 10, fontWeight: "700" }}>Saqlanmoqda...</Text>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    actions: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 12, marginBottom: 8 },
    addBtn: { backgroundColor: "#770E13", borderRadius: 12, paddingVertical: 12, paddingHorizontal: 16 },
    addBtnText: { color: "#fff", fontWeight: "800" },
    totalBox: { alignItems: "flex-end" },
    totalLabel: { color: "#444", fontWeight: "600" },
    totalVal: { color: "#222", fontWeight: "800", marginTop: 2 },
    saveBtn: { marginHorizontal: 12, marginTop: 6, backgroundColor: "#770E13", borderRadius: 14, alignItems: "center", paddingVertical: 14 },
    saveBtnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
    historyBtn: { marginHorizontal: 12, padding: 12, borderWidth: 1, borderColor: "#F4C7CB", backgroundColor: "#FCE9EA", borderRadius: 10, alignItems: "center" },
    historyText: { color: "#770E13", fontWeight: "800" },
    modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", alignItems: "center", justifyContent: "center" },
    modalCard: { backgroundColor: "#fff", padding: 20, borderRadius: 14, minWidth: 180, alignItems: "center" },
    editingTag: { marginHorizontal: 12, padding: 10, borderRadius: 10, backgroundColor: "#FCE9EA", borderWidth: 1, borderColor: "#F4C7CB", alignItems: "center" },
    banner: { position: "absolute", top: 8, left: 12, right: 12, zIndex: 20, backgroundColor: "#E7F8ED", borderColor: "#B6E2C1", borderWidth: 1, padding: 10, borderRadius: 10, alignItems: "center" },
    bannerText: { color: "#116B2A", fontWeight: "800" },
});
