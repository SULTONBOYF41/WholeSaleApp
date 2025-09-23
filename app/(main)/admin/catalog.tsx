// app/(main)/admin/catalog.tsx
import Toast from "@/components/Toast";
import { Button, C, Card, Chip, H1, H2, Input } from "@/components/UI";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/appStore";
import { useSyncStore } from "@/store/syncStore";
import { useToastStore } from "@/store/toastStore";
import type { Product } from "@/types";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Alert, FlatList, Text, TouchableOpacity, View } from "react-native";

type Target = "branch" | "market" | "both";
const PRIMARY = "#770E13";

// RFC4122 v4 (soddalashtirilgan) — add-store.tsx dagi bilan bir xil
function uuidv4() {
    return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = (Math.random() * 16) | 0;
        const v = c === "x" ? r : (r & 0x3) | 0x8;
        return v.toString(16);
    });
}


export default function Catalog() {
    const products = useAppStore((s) => s.products);
    const upsertProduct = useAppStore((s) => s.upsertProduct);
    const removeProduct = useAppStore((s) => s.removeProduct);

    const online = useSyncStore((s) => s.online);
    const toast = useToastStore();

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
        const trimmed = name.trim();
        if (!trimmed) return;

        // Narxlarni tayyorlab olamiz
        let pb: number | null | undefined = undefined;
        let pm: number | null | undefined = undefined;

        if (target === "both") {
            pb = priceBranch.trim() === "" ? null : Number(priceBranch);
            pm = priceMarket.trim() === "" ? null : Number(priceMarket);
        } else {
            const v = price.trim() === "" ? null : Number(price);
            pb = target === "branch" ? v : (editing?.priceBranch ?? null);
            pm = target === "market" ? v : (editing?.priceMarket ?? null);
        }

        // ONLINE: bevosita Supabase'ga yozamiz (id'ni ALBATTA yuboramiz!)
        if (online) {
            toast.showLoading(editing ? "Yangilanmoqda…" : "Saqlanmoqda…");
            try {
                const productId = editing?.id ?? uuidv4(); // <-- MUHIM: yangi bo'lsa id yaratamiz

                const row = {
                    id: productId,
                    name: trimmed,
                    price_branch: pb ?? null,
                    price_market: pm ?? null,
                };

                const { error } = await supabase
                    .from("products")
                    .upsert(row, { onConflict: "id" });

                if (error) throw error;

                // snapshotni yangilaymiz
                try { await useAppStore.getState().pullNow(); } catch { }

                toast.hide();
                toast.show(editing ? "Tahrir saqlandi" : "Mahsulot qo‘shildi");
                resetForm();
            } catch (e: any) {
                toast.hide();
                toast.show(e?.message || "Saqlashda xato");
            }
            return;
        }

        // OFFLINE: lokal + queue (sizdagi oqim o'zgarishsiz qoladi)
        toast.showLoading("Offline: navbatga yozildi");
        try {
            await upsertProduct({
                id: editing?.id, // offline oqim o'zi id beradi (pr-... format)
                name: trimmed,
                priceBranch: pb ?? undefined,
                priceMarket: pm ?? undefined,
            });

            // tezroq ko‘rinishi uchun push→pull urinib ko‘rish mumkin (ixtiyoriy)
            try { await useAppStore.getState().pushNow(); } catch { }
            try { await useAppStore.getState().pullNow(); } catch { }

            toast.hide();
            toast.show(editing ? "Tahrir navbatga yozildi (offline)" : "Qo‘shish navbatga yozildi (offline)");
            resetForm();
        } catch {
            toast.hide();
            toast.show("Offline navbatga yozishda xato");
        }
    };



    const startEdit = (p: Product) => {
        setEditing(p);
        setName(p?.name ?? "");
        // Edit UX: ikkala narx maydonini ko‘rsatamiz
        setTarget("both");
        setPrice("");
        setPriceBranch(p?.priceBranch != null ? String(p.priceBranch) : "");
        setPriceMarket(p?.priceMarket != null ? String(p.priceMarket) : "");
    };

    const askRemove = (id: string) =>
        Alert.alert("Олиб ташлаш", "Ростдан ҳам ўчирилсинми?", [
            { text: "Бекор" },
            {
                text: "Ҳа",
                style: "destructive",
                onPress: async () => {
                    // 1) Optimistik: darrov lokal ro‘yxatdan o‘chirib, navbatga yozamiz
                    //    (UI darhol yangilanadi)
                    try {
                        await removeProduct(id);
                    } catch { }

                    // Agar hozir tahrirlayotgan bo‘lsak, formani tozalaymiz
                    if (editing?.id === id) {
                        resetForm();
                    }

                    // 2) Onlayn bo‘lsa – bevosita serverdan ham o‘chirishga harakat qilamiz
                    //    (muvaffaqiyatli bo‘lsa – pull; bo‘lmasa – queue allaqachon bor)
                    if (online) {
                        toast.show("O‘chirilmoqda…");
                        try {
                            const { error } = await supabase.from("products").delete().eq("id", id);
                            if (error) throw error;
                        } catch {
                            // ignore – pushNow navbatdagi product_remove bilan urinishda davom etadi
                        }

                        // 3) Navbatni tezroq tozalash va snapshotni yangilash
                        try { await useAppStore.getState().pushNow(); } catch { }
                        try { await useAppStore.getState().pullNow(); } catch { }
                    }
                },
            },
        ]);


    // --- Realtime + polling (o‘zgarmadi) ---
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        useAppStore.getState().startPull().catch(() => { });
        useAppStore.getState().pullNow().catch(() => { });

        const ch = supabase
            .channel("rt-products")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "products" },
                () => useAppStore.getState().pullNow().catch(() => { })
            )
            .subscribe();

        pollRef.current = setInterval(() => {
            useAppStore.getState().pullNow().catch(() => { });
        }, 15000);

        return () => {
            if (pollRef.current !== null) {
                clearInterval(pollRef.current);
                pollRef.current = null;
            }
            supabase.removeChannel(ch);
        };
    }, []);

    // Xavfsiz sort
    const listData = useMemo(
        () =>
            [...products].sort((a: any, b: any) =>
                String(a?.name ?? a?.title ?? "").localeCompare(String(b?.name ?? b?.title ?? ""))
            ),
        [products]
    );

    const Header = useMemo(
        () => (
            <View style={{ padding: 16, gap: 10 }}>
                <H1 style={{ color: PRIMARY }}>Каталог</H1>

                <H2 style={{ marginTop: 6 }}>Маҳсулот номи</H2>
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

                <Button onPress={submit} title={editing ? "Сақлаш" : "Қўшиш"} style={{ marginTop: 8, backgroundColor: PRIMARY }} />

                <H2 style={{ marginTop: 10 }}>Маҳсулотлар</H2>
            </View>
        ),
        [name, target, price, priceBranch, priceMarket, editing]
    );

    return (
        <>
            <FlatList
                data={listData}
                keyExtractor={(i: any) => String(i?.id ?? i?._id)}
                ListHeaderComponent={Header}
                ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
                contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}
                renderItem={({ item }: { item: any }) => {
                    const displayName = item?.name ?? item?.title ?? "(nom yo‘q)";
                    return (
                        <Card style={{ padding: 12 }}>
                            <View style={{ flexDirection: "row", alignItems: "center" }}>
                                {/* Chap: nom + narxlar */}
                                <View style={{ flex: 1, paddingRight: 10 }}>
                                    <Text
                                        style={{ fontWeight: "800", color: C.text }}
                                        numberOfLines={1}
                                        ellipsizeMode="tail"
                                    >
                                        {displayName}
                                    </Text>
                                    <Text style={{ color: C.muted, marginTop: 4 }}>
                                        Филиал: {item?.priceBranch ?? 0} · Дўкон: {item?.priceMarket ?? 0}
                                    </Text>
                                </View>

                                {/* O‘ng: edit / delete */}
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
                                        accessibilityLabel="Tahrirlash"
                                    >
                                        <Ionicons name="create-outline" size={20} color={PRIMARY} />
                                    </TouchableOpacity>

                                    <TouchableOpacity
                                        onPress={() => askRemove(item?.id ?? item?._id)}
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
                                        accessibilityLabel="O'chirish"
                                    >
                                        <Ionicons name="close-outline" size={20} color="#E23D3D" />
                                    </TouchableOpacity>
                                </View>
                            </View>
                        </Card>
                    );
                }}
            />
            <Toast />
        </>
    );
}
