// app/(main)/admin/add-store.tsx
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import { Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";

import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import { useToastStore } from "@/store/toastStore";

type StoreType = "branch" | "market";
const PRIMARY = "#770E13";
const DELETE_PIN = "2112";

const genId = () => `${Date.now()}_${Math.random().toString(16).slice(2)}`;

export default function AddStore() {
    const toast = useToastStore();

    const categories = useAppStore((s: any) => (Array.isArray(s.categories) ? s.categories : []));
    const stores = useAppStore((s) => s.stores);

    const upsertStore = useAppStore((s) => s.upsertStore);
    const removeStore = useAppStore((s) => s.removeStore);

    const online = useSyncStore((s) => s.online);
    const pushAndPullNow = useSyncStore((s) => s.pushAndPullNow);

    const [name, setName] = useState("");
    const [type, setType] = useState<StoreType>("branch");
    const [prices, setPrices] = useState<Record<string, string>>({});
    const [editingId, setEditingId] = useState<string | null>(null);

    const [pinVisible, setPinVisible] = useState(false);
    const [pinText, setPinText] = useState("");
    const [pinError, setPinError] = useState<string | null>(null);
    const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);

    const list = useMemo(() => stores ?? [], [stores]);

    const reset = () => {
        setName("");
        setType("branch");
        setPrices({});
        setEditingId(null);
    };

    const normalizePrices = () => {
        const out: Record<string, number> = {};
        Object.entries(prices || {}).forEach(([k, v]) => {
            const t = String(v ?? "").trim();
            if (!t) return;
            const n = Number(t);
            if (Number.isFinite(n)) out[String(k)] = n;
        });
        return out;
    };

    const onSave = async () => {
        const nm = name.trim();
        if (!nm) {
            toast.show("Nomi bo‘sh bo‘lmasin");
            return;
        }

        const id = editingId ?? genId();

        try {
            toast.showLoading("Saqlanmoqda…", 0);
            await upsertStore({ id, name: nm, type, prices: normalizePrices() });

            // ✅ Online bo‘lsa sync (expenses ham ketadi)
            if (online) {
                await pushAndPullNow();
            }

            toast.hide();
            toast.show(editingId ? "Tahrir saqlandi" : "Qo‘shildi");
            reset();
        } catch (e: any) {
            toast.hide();
            toast.show(e?.message ?? "Xatolik");
        }
    };

    const onEdit = (st: any) => {
        setEditingId(String(st.id));
        setName(String(st.name ?? ""));
        setType((st.type ?? "branch") as StoreType);

        const p: Record<string, string> = {};
        Object.entries(st.prices ?? {}).forEach(([k, v]) => (p[String(k)] = String(v ?? "")));
        setPrices(p);
    };

    const askDelete = (id: string) => {
        setPendingDeleteId(String(id));
        setPinText("");
        setPinError(null);
        setPinVisible(true);
    };

    const doDelete = async () => {
        if (!pendingDeleteId) return;

        if (pinText !== DELETE_PIN) {
            setPinError("PIN noto‘g‘ri");
            return;
        }

        try {
            toast.showLoading("O‘chirilmoqda…", 0);
            await removeStore(pendingDeleteId);

            if (online) {
                await pushAndPullNow();
            }

            toast.hide();
            toast.show("O‘chirildi");
        } catch (e: any) {
            toast.hide();
            toast.show(e?.message ?? "Xatolik");
        } finally {
            setPinVisible(false);
            setPendingDeleteId(null);
            setPinText("");
            setPinError(null);
        }
    };

    return (
        <View style={{ flex: 1 }}>
            <ScrollView contentContainerStyle={{ padding: 14, paddingBottom: 28 }}>
                <Text style={styles.h1}>Filial / Do‘kon qo‘shish</Text>

                <Text style={styles.label}>Nomi</Text>
                <TextInput value={name} onChangeText={setName} placeholder="Masalan: Urganch filial" style={styles.input} />

                <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                    <TouchableOpacity onPress={() => setType("branch")} style={[styles.typeBtn, type === "branch" && styles.typeBtnActive]}>
                        <Text style={[styles.typeText, type === "branch" && styles.typeTextActive]}>Filial</Text>
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setType("market")} style={[styles.typeBtn, type === "market" && styles.typeBtnActive]}>
                        <Text style={[styles.typeText, type === "market" && styles.typeTextActive]}>Do‘kon</Text>
                    </TouchableOpacity>
                </View>

                <Text style={[styles.label, { marginTop: 14 }]}>Kategoriya narxlari (ixtiyoriy)</Text>
                {categories.length === 0 ? (
                    <Text style={{ color: "#6B7280" }}>Kategoriyalar yo‘q. Avval “Catalog”dan qo‘shing.</Text>
                ) : (
                    categories.map((c: any) => (
                        <View key={String(c.id)} style={styles.priceRow}>
                            <Text style={{ width: 140 }}>{c.name}</Text>
                            <TextInput
                                value={prices[String(c.id)] ?? ""}
                                onChangeText={(v) => setPrices((p) => ({ ...p, [String(c.id)]: v }))}
                                keyboardType="numeric"
                                placeholder="0"
                                style={[styles.input, { flex: 1, marginTop: 0 }]}
                            />
                        </View>
                    ))
                )}

                {editingId && (
                    <View style={styles.editTag}>
                        <Text style={{ color: PRIMARY, fontWeight: "900" }}>Tahrirlash rejimi</Text>
                        <TouchableOpacity onPress={reset} style={styles.cancelBtn}>
                            <Text style={{ color: PRIMARY, fontWeight: "900" }}>Bekor qilish</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <TouchableOpacity onPress={onSave} style={styles.saveBtn}>
                    <Text style={{ color: "#fff", fontWeight: "900", fontSize: 16 }}>
                        {editingId ? "O‘zgartirishni saqlash" : "Saqlash"}
                    </Text>
                </TouchableOpacity>

                <View style={{ height: 18 }} />

                <Text style={styles.h2}>Ro‘yxat</Text>
                {list.map((st: any) => (
                    <View key={String(st.id)} style={styles.card}>
                        <View style={{ flex: 1 }}>
                            <Text style={{ fontWeight: "900", fontSize: 16 }}>{st.name}</Text>
                            <Text style={{ color: "#6B7280" }}>{st.type === "branch" ? "Filial" : "Do‘kon"}</Text>
                        </View>

                        <TouchableOpacity onPress={() => onEdit(st)} style={styles.iconBtn}>
                            <Ionicons name="create-outline" size={20} color={PRIMARY} />
                        </TouchableOpacity>

                        <TouchableOpacity onPress={() => askDelete(String(st.id))} style={[styles.iconBtn, { backgroundColor: "#FCE9EA", borderColor: "#F4C7CB" }]}>
                            <Ionicons name="trash-outline" size={20} color={PRIMARY} />
                        </TouchableOpacity>
                    </View>
                ))}
            </ScrollView>

            <Modal visible={pinVisible} transparent animationType="fade" onRequestClose={() => setPinVisible(false)}>
                <View style={styles.modalWrap}>
                    <View style={styles.modalCard}>
                        <Text style={{ fontSize: 18, fontWeight: "900", color: PRIMARY }}>O‘chirishni tasdiqlang</Text>
                        <Text style={{ marginTop: 8, color: "#4B5563" }}>
                            Diqqat! Filial/do‘kon o‘chsa, unga tegishli ma’lumotlar ham yo‘qoladi.
                        </Text>

                        <Text style={{ marginTop: 12, fontWeight: "900" }}>PIN (4 raqam)</Text>
                        <TextInput
                            value={pinText}
                            onChangeText={(t) => {
                                setPinText(t.replace(/\D/g, "").slice(0, 4));
                                setPinError(null);
                            }}
                            keyboardType="number-pad"
                            maxLength={4}
                            placeholder="••••"
                            style={[styles.input, { marginTop: 6, letterSpacing: 4, fontSize: 18, borderColor: pinError ? "#ef4444" : "#E5E7EB" }]}
                        />
                        {!!pinError && <Text style={{ color: "#ef4444", marginTop: 6 }}>{pinError}</Text>}

                        <View style={{ flexDirection: "row", gap: 10, justifyContent: "flex-end", marginTop: 14 }}>
                            <TouchableOpacity onPress={() => setPinVisible(false)} style={[styles.btn, { backgroundColor: "#F3F4F6" }]}>
                                <Text style={{ fontWeight: "900" }}>Bekor</Text>
                            </TouchableOpacity>
                            <TouchableOpacity onPress={doDelete} style={[styles.btn, { backgroundColor: "#ef4444" }]}>
                                <Text style={{ fontWeight: "900", color: "#fff" }}>O‘chirish</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
}

const styles = StyleSheet.create({
    h1: { fontSize: 18, fontWeight: "900", marginBottom: 10 },
    h2: { fontSize: 16, fontWeight: "900", marginBottom: 10 },
    label: { fontWeight: "800", marginTop: 10, marginBottom: 6 },
    input: { borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, marginTop: 6, backgroundColor: "#fff" },

    typeBtn: { flex: 1, borderWidth: 1, borderColor: "#E5E7EB", borderRadius: 12, paddingVertical: 12, alignItems: "center", backgroundColor: "#fff" },
    typeBtnActive: { borderColor: PRIMARY, backgroundColor: "#FCE9EA" },
    typeText: { fontWeight: "900", color: "#111827" },
    typeTextActive: { color: PRIMARY },

    priceRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 10 },

    editTag: { marginTop: 12, padding: 10, borderRadius: 12, backgroundColor: "#FCE9EA", borderWidth: 1, borderColor: "#F4C7CB", alignItems: "center" },
    cancelBtn: { marginTop: 8, borderWidth: 1, borderColor: "#F4C7CB", backgroundColor: "#fff", paddingVertical: 10, paddingHorizontal: 14, borderRadius: 10 },

    saveBtn: { marginTop: 14, backgroundColor: PRIMARY, borderRadius: 14, alignItems: "center", paddingVertical: 14 },

    card: { flexDirection: "row", alignItems: "center", gap: 10, borderWidth: 1, borderColor: "#eee", borderRadius: 14, padding: 12, marginBottom: 10, backgroundColor: "#fff" },
    iconBtn: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: "#E5E7EB", backgroundColor: "#fff", alignItems: "center", justifyContent: "center" },

    modalWrap: { flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "center", padding: 16 },
    modalCard: { backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E5E7EB" },
    btn: { paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12 },
});
