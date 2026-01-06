// app/(main)/admin/add-store.tsx
import Toast from "@/components/Toast";
import { Button, C, Card, Chip, H1, H2, Input } from "@/components/UI";
import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import { useToastStore } from "@/store/toastStore";
import type { Store, StoreType } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Modal, SectionList, Text, TextInput, TouchableOpacity, View } from "react-native";

const PRIMARY = "#770E13";
const DELETE_PIN = "2112";

// RFC4122 v4 (soddalashtirilgan)
function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}

export default function AddStore() {
    const categories = useAppStore((s) => s.categories);
    const stores = useAppStore((s) => s.stores);

    const upsertStoreLocal = useAppStore((s) => s.upsertStore);
    const removeStoreLocal = useAppStore((s) => s.removeStore);

    const pullNow = useAppStore((s) => s.pullNow);
    const pushNow = useAppStore((s) => s.pushNow);

    const online = useSyncStore((s) => s.online);
    const toast = useToastStore();

    const [name, setName] = useState("");
    const [type, setType] = useState<StoreType>("branch");
    const [prices, setPrices] = useState<Record<string, string>>({});
    const [editing, setEditing] = useState<Store | null>(null);

    const submittingRef = useRef(false);

    const [pinVisible, setPinVisible] = useState(false);
    const [pinText, setPinText] = useState("");
    const [pinStoreId, setPinStoreId] = useState<string | null>(null);
    const [pinError, setPinError] = useState<string | null>(null);

    const branches = stores.filter((s) => s.type === "branch");
    const markets = stores.filter((s) => s.type === "market");

    const sections = useMemo(
        () => [
            { title: "Филиаллар", data: branches },
            { title: "Дўконлар", data: markets },
        ],
        [branches, markets]
    );

    const changePrice = (catId: string, v: string) => setPrices((p) => ({ ...p, [catId]: v }));

    const resetForm = () => {
        setName("");
        setType("branch");
        setPrices({});
        setEditing(null);
    };

    const normalizePrices = (): Record<string, number> => {
        const out: Record<string, number> = {};
        for (const [k, v] of Object.entries(prices)) {
            const n = Number(v);
            if (Number.isFinite(n) && v !== "") out[k] = n;
        }
        return out;
    };

    const syncNow = async () => {
        // Sizda pushAndPullNow bor deb turibmiz, bo‘lmasa fallback:
        const maybe = (useSyncStore.getState() as any).pushAndPullNow;
        if (typeof maybe === "function") return maybe();

        // fallback:
        try {
            await pushNow();
        } catch { }
        try {
            await pullNow();
        } catch { }
    };

    const submit = async () => {
        if (submittingRef.current) return;

        if (!name.trim()) {
            toast.show("Nomi bo‘sh bo‘lmasin");
            return;
        }

        submittingRef.current = true;

        const payload = {
            name: name.trim(),
            type,
            prices: normalizePrices(),
        };

        try {
            toast.showLoading(editing ? "Yangilanmoqda…" : "Saqlanmoqda…");

            const isEditing = Boolean(editing?.id);
            const id = editing?.id ?? uuidv4();

            // ✅ har doim LOCAL ga yozamiz (offline/online farqi yo‘q)
            await upsertStoreLocal({
                id,
                name: payload.name,
                type: payload.type,
                prices: payload.prices,
            });

            // ✅ online bo‘lsa serverga yuboramiz
            if (online) {
                await syncNow();
            }

            resetForm();
            toast.hide();
            toast.show(isEditing ? "Tahrir saqlandi" : "Do‘kon qo‘shildi");
        } catch (e: any) {
            toast.hide();
            const msg = e?.message?.includes("Network request failed")
                ? "Tarmoq yo‘q. Offline rejimda saqlanadi."
                : e?.message ?? "Saqlashda xato";
            toast.show(msg);
        } finally {
            submittingRef.current = false;
        }
    };

    const startEdit = (s: Store) => {
        setEditing(s);
        setName(s.name);
        setType(s.type);
        const p: Record<string, string> = {};
        Object.entries(s.prices || {}).forEach(([k, v]) => (p[k] = String(v as number)));
        setPrices(p);
    };

    const confirmRemove = (id: string) => {
        setPinStoreId(id);
        setPinText("");
        setPinError(null);
        setPinVisible(true);
    };

    const doRemoveNow = async () => {
        if (!pinStoreId) return;

        if (pinText !== DELETE_PIN) {
            setPinError("PIN noto‘g‘ri kiritildi");
            return;
        }
        setPinError(null);

        try {
            toast.showLoading("O‘chirilmoqda…");

            // ✅ har doim LOCAL dan o‘chir (queue ham shu yerda)
            await removeStoreLocal(pinStoreId);

            // ✅ online bo‘lsa serverga push qilib snapshotni yangilaymiz
            if (online) {
                await syncNow();
            }

            toast.hide();
            toast.show("O‘chirildi");
        } catch (e: any) {
            toast.hide();
            toast.show(e?.message || "O‘chirishda xato");
        } finally {
            setPinVisible(false);
            setPinStoreId(null);
            setPinText("");
        }
    };

    // --- Online bo‘lsa polling: stores/products/cat narxlari yangilanishi uchun
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (online) {
            // kirishda 1 marta sync
            syncNow().catch(() => { });
            if (!pollRef.current) {
                pollRef.current = setInterval(() => {
                    useAppStore.getState().pullNow().catch(() => { });
                }, 15000);
            }
        } else {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        }

        return () => {
            if (pollRef.current) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [online]);

    const ListHeader = useMemo(
        () => (
            <View style={{ padding: 16, paddingBottom: 0, gap: 10 }}>
                <H1>Филиал/Дўкон қўшиш</H1>

                <H2>Номи</H2>
                <Input value={name} onChangeText={setName} placeholder="" />

                <View style={{ flexDirection: "row", gap: 8, marginTop: 2 }}>
                    <TouchableOpacity onPress={() => setType("branch")} style={{ flex: 1 }}>
                        <Chip active={type === "branch"} label="Филиал" style={{ alignItems: "center" }} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={() => setType("market")} style={{ flex: 1 }}>
                        <Chip active={type === "market"} label="Дўкон" style={{ alignItems: "center" }} />
                    </TouchableOpacity>
                </View>

                <H2>Категориялар ва нарх (сўм)</H2>
                {categories.length === 0 && (
                    <Text style={{ color: C.muted }}>Категориялар ҳали йўқ — аввало “Каталог”дан қўшинг.</Text>
                )}

                {categories.map((c) => (
                    <View key={c.id} style={{ flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 }}>
                        <Text style={{ width: 140 }}>{c.name}</Text>
                        <Input
                            value={prices[c.id] ?? ""}
                            onChangeText={(v: string) => changePrice(c.id, v)}
                            keyboardType="numeric"
                            style={{ flex: 1 }}
                        />
                    </View>
                ))}

                <Button onPress={submit} title={editing ? "Сақлаш" : "Қўшиш"} />

                <H2 style={{ marginTop: 8 }}>Жорий рўйхат</H2>
            </View>
        ),
        [name, type, prices, categories.length, editing]
    );

    return (
        <>
            <SectionList
                sections={sections}
                keyExtractor={(item) => item.id}
                stickySectionHeadersEnabled
                ListHeaderComponent={ListHeader}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                renderSectionHeader={({ section }) => (
                    <View style={{ backgroundColor: C.bg, paddingVertical: 8 }}>
                        <Text style={{ fontWeight: "800", color: C.text }}>{section.title}</Text>
                    </View>
                )}
                renderItem={({ item }) => (
                    <Card style={{ marginTop: 8, padding: 12 }}>
                        <View style={{ flexDirection: "row", alignItems: "center" }}>
                            <View style={{ flex: 1, paddingRight: 10 }}>
                                <Text style={{ fontWeight: "800", color: C.text }}>{item.name}</Text>
                                <Text style={{ color: C.muted }}>{item.type === "branch" ? "Филиал" : "Дўкон"}</Text>
                            </View>

                            <View style={{ flexDirection: "row", gap: 10 }}>
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
                                    accessibilityLabel="Таҳрирлаш"
                                >
                                    <Ionicons name="create-outline" size={20} color={PRIMARY} />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    onPress={() => confirmRemove(item.id)}
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
                                    accessibilityLabel="Ўчириш"
                                >
                                    <Ionicons name="close-outline" size={20} color="#E23D3D" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </Card>
                )}
            />

            {/* DELETE PIN MODAL */}
            <Modal visible={pinVisible} transparent animationType="fade" onRequestClose={() => setPinVisible(false)}>
                <View style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.25)", justifyContent: "center", padding: 16 }}>
                    <View style={{ backgroundColor: "#fff", borderRadius: 16, padding: 16, borderWidth: 1, borderColor: "#E9ECF1" }}>
                        <Text style={{ fontSize: 18, fontWeight: "900", color: PRIMARY }}>O‘chirishni tasdiqlang</Text>
                        <Text style={{ marginTop: 8, color: "#4B5563" }}>
                            Diqqat! Ushbu filial/do‘kon o‘chirilsа, unga tegishli barcha ma’lumotlar (sotuvlar, qaytarishlar,
                            olingan summalar) ham o‘chadi.
                        </Text>

                        <Text style={{ marginTop: 12, fontWeight: "800" }}>4 xonali PIN kiriting</Text>
                        <TextInput
                            value={pinText}
                            onChangeText={(t) => {
                                setPinText(t.replace(/\D/g, "").slice(0, 4));
                                setPinError(null);
                            }}
                            keyboardType="number-pad"
                            maxLength={4}
                            placeholder="••••"
                            style={{
                                marginTop: 6,
                                borderWidth: 1,
                                borderColor: pinError ? "#ef4444" : "#E9ECF1",
                                borderRadius: 10,
                                paddingHorizontal: 12,
                                paddingVertical: 10,
                                fontSize: 18,
                                letterSpacing: 4,
                            }}
                        />
                        {pinError ? <Text style={{ color: "#ef4444", marginTop: 6 }}>{pinError}</Text> : null}

                        <View style={{ flexDirection: "row", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
                            <TouchableOpacity
                                onPress={() => {
                                    setPinVisible(false);
                                    setPinText("");
                                    setPinStoreId(null);
                                    setPinError(null);
                                }}
                                style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#F3F4F6" }}
                            >
                                <Text style={{ fontWeight: "800" }}>Bekor</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                onPress={doRemoveNow}
                                style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#ef4444" }}
                            >
                                <Text style={{ fontWeight: "800", color: "#fff" }}>O‘chirish</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            <Toast />
        </>
    );
}
