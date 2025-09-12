// app/(main)/store/[id]/dashboard.tsx
import Toast from "@/components/Toast";
import { exportDashboardPdf } from "@/lib/pdf";
import { useAppStore } from "@/store/appStore";
import { useToastStore } from "@/store/toastStore";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    Linking,
    Modal,
    Pressable,
    ScrollView,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const P = "#770E13";

export default function Dashboard() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const allSales = useAppStore((s) => s.sales);
    const allReturns = useAppStore((s) => s.returns);
    const cash = useAppStore((s) => s.cashReceipts);
    const stores = useAppStore((s) => s.stores);
    const storeName = stores.find((s) => s.id === id)?.name ?? "";

    const toast = useToastStore();

    // PDF modal holati
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [pdfLink, setPdfLink] = useState<string | null>(null);
    const [pdfName, setPdfName] = useState<string>("Hisobot.pdf");

    // Oy tanlovi
    const [month, setMonth] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
    const inMonth = (t: number) => {
        const d = new Date(t);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return key === month;
    };

    const sales = useMemo(
        () => allSales.filter((x) => x.storeId === id && inMonth(x.created_at)),
        [allSales, id, month]
    );
    const returns = useMemo(
        () => allReturns.filter((x) => x.storeId === id && inMonth(x.created_at)),
        [allReturns, id, month]
    );
    const receipts = useMemo(
        () => cash.filter((x) => x.storeId === id && inMonth(x.created_at)),
        [cash, id, month]
    );

    const totalSales = useMemo(() => sales.reduce((a, s) => a + s.price * s.qty, 0), [sales]);
    const totalCash = useMemo(() => receipts.reduce((a, r) => a + r.amount, 0), [receipts]);
    const debt = Math.max(totalSales - totalCash, 0);
    const returnCount = returns.length;

    const salesRank = useMemo(() => {
        const map = new Map<string, { qty: number; total: number }>();
        for (const s of sales) {
            const cur = map.get(s.productName) ?? { qty: 0, total: 0 };
            cur.qty += s.qty;
            cur.total += s.qty * s.price;
            map.set(s.productName, cur);
        }
        return Array.from(map.entries())
            .map(([name, v]) => ({ name, qty: v.qty, total: v.total }))
            .sort((a, b) => b.total - a.total);
    }, [sales]);

    const returnRank = useMemo(() => {
        const map = new Map<string, number>();
        for (const r of returns) {
            map.set(r.productName, (map.get(r.productName) ?? 0) + r.qty);
        }
        return Array.from(map.entries())
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty);
    }, [returns]);

    const money = (n: number) => `${(n || 0).toLocaleString()} so‘m`;

    // PDF export: toast → generate → toast.hide → modal
    const exportPdf = async () => {
        toast.showLoading("Saqlanmoqda…", 0); // qo‘lda yopamiz
        let result: any = null;
        try {
            result = await exportDashboardPdf({
                storeName,
                periodLabel: month,
                cards: { totalSales, totalCash, debt, returnCount },
                salesRank,
                returnRank,
            });
        } catch (e) {
            // xohlasangiz: toast.show("Xatolik yuz berdi")
        }
        toast.hide();

        const link =
            typeof result === "string"
                ? result
                : (result?.uri as string) || (result?.url as string) || null;

        const nameGuess =
            (result?.name as string) ||
            `Hisobot_${storeName || "Store"}_${month}.pdf`;

        setPdfName(nameGuess);
        setPdfLink(link);
        setPdfModalOpen(true);
    };

    const shiftMonth = (delta: number) => {
        const [y, m] = month.split("-").map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    };

    const openPdf = async () => {
        if (!pdfLink) return;
        try { await Linking.openURL(pdfLink); } catch { }
    };

    return (
        <>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
                {/* Oy va PDF */}
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <TouchableOpacity onPress={() => shiftMonth(-1)} style={{ padding: 6 }}>
                        <Text style={{ fontWeight: "800" }}>‹</Text>
                    </TouchableOpacity>
                    <Text style={{ fontWeight: "800", fontSize: 16, marginHorizontal: 8 }}>{month}</Text>
                    <TouchableOpacity onPress={() => shiftMonth(1)} style={{ padding: 6 }}>
                        <Text style={{ fontWeight: "800" }}>›</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                        onPress={exportPdf}
                        style={{
                            backgroundColor: P,
                            paddingVertical: 10,
                            paddingHorizontal: 12,
                            borderRadius: 10,
                        }}
                    >
                        <Text style={{ color: "#fff", fontWeight: "800" }}>PDF</Text>
                    </TouchableOpacity>
                </View>

                {/* 2x2 cards */}
                <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1, gap: 12 }}>
                        <StatCard title="Umumiy summa" value={money(totalSales)} />
                        <StatCard title="Qarz" value={money(debt)} />
                    </View>
                    <View style={{ flex: 1, gap: 12 }}>
                        <StatCard title="Olingan summa" value={money(totalCash)} />
                        <StatCard title="Vazvrat (miqdor)" value={String(returnCount)} />
                    </View>
                </View>

                {/* Reytinglar */}
                <View style={{ height: 14 }} />
                <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 6 }}>Sotuv reytingi</Text>
                <RankTableSales rows={salesRank} />

                <View style={{ height: 16 }} />
                <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 6 }}>Vazvrat reytingi</Text>
                <RankTableReturns rows={returnRank} />
            </ScrollView>

            {/* PDF MODAL */}
            <Modal
                visible={pdfModalOpen}
                transparent
                animationType="fade"
                onRequestClose={() => setPdfModalOpen(false)}
            >
                <Pressable
                    onPress={() => setPdfModalOpen(false)}
                    style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}
                >
                    <View
                        // Eslatma: Matnlar faqat <Text> ichida! Bu yerda View ichida faqat View/Text/Tugmalar bor.
                        style={{
                            backgroundColor: "#fff",
                            borderRadius: 16,
                            borderWidth: 1,
                            borderColor: "#E9ECF1",
                            padding: 16,
                            shadowColor: "#000",
                            shadowOpacity: 0.12,
                            shadowRadius: 18,
                            shadowOffset: { width: 0, height: 10 },
                            elevation: 6,
                        }}
                    >
                        <Text style={{ fontSize: 18, fontWeight: "900", color: P }}>PDF hisobot tayyor!</Text>

                        <Text style={{ marginTop: 8, color: "#4B5563" }}>
                            Quyidagi havola — tanlagan davrdagi ({month}) “{storeName || "Do‘kon"}” uchun
                            avtomatik hosil qilingan PDF hisobot. Uni ochishingiz yoki keyinroq ulashishingiz mumkin.
                        </Text>

                        <View
                            style={{
                                marginTop: 12,
                                padding: 12,
                                borderWidth: 1,
                                borderColor: "#E9ECF1",
                                borderRadius: 12,
                                backgroundColor: "#F9FAFB",
                            }}
                        >
                            <Text style={{ fontWeight: "800" }}>{pdfName}</Text>
                            <Text
                                style={{ color: "#2563EB", marginTop: 6, textDecorationLine: "underline" }}
                                numberOfLines={2}
                            >
                                {String(pdfLink ?? "Havola topilmadi")}
                            </Text>
                        </View>

                        <View style={{ flexDirection: "row", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
                            <TouchableOpacity
                                onPress={() => setPdfModalOpen(false)}
                                style={{
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                    borderRadius: 12,
                                    backgroundColor: "#F3F4F6",
                                }}
                            >
                                <Text style={{ fontWeight: "800" }}>Yopish</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                disabled={!pdfLink}
                                onPress={openPdf}
                                style={{
                                    paddingVertical: 12,
                                    paddingHorizontal: 16,
                                    borderRadius: 12,
                                    backgroundColor: pdfLink ? P : "#D1D5DB",
                                }}
                            >
                                <Text style={{ fontWeight: "800", color: "#fff" }}>Ochish</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </Pressable>
            </Modal>

            <Toast />
        </>
    );
}

/** --- Presentational components --- */

function StatCard({ title, value }: { title: string; value: string }) {
    return (
        <View
            style={{
                backgroundColor: "#fff",
                borderWidth: 1,
                borderColor: "#E9ECF1",
                borderRadius: 16,
                padding: 14,
            }}
        >
            <Text style={{ color: "#6B7280", fontWeight: "800" }}>{title}</Text>
            <Text style={{ fontSize: 20, fontWeight: "900", marginTop: 6 }}>{value}</Text>
        </View>
    );
}

function RankTableSales({ rows }: { rows: { name: string; qty: number; total: number }[] }) {
    if (rows.length === 0) return <Text style={{ color: "#777" }}>Reyting bo‘sh</Text>;
    return (
        <View style={{ borderWidth: 1, borderColor: "#E9ECF1", borderRadius: 12, overflow: "hidden" }}>
            <View style={{ flexDirection: "row", backgroundColor: "#F9FAFB" }}>
                <Cell flex label="Mahsulot" bold />
                <Cell width={90} label="Miqdor" right bold />
                <Cell width={120} label="Daromad" right bold />
            </View>
            {rows.map((r, i) => (
                <View key={i} style={{ flexDirection: "row" }}>
                    <Cell flex label={r.name} />
                    <Cell width={90} label={String(r.qty)} right />
                    <Cell width={120} label={String((r.total || 0).toLocaleString())} right />
                </View>
            ))}
        </View>
    );
}
function RankTableReturns({ rows }: { rows: { name: string; qty: number }[] }) {
    if (rows.length === 0) return <Text style={{ color: "#777" }}>Reyting bo‘sh</Text>;
    return (
        <View style={{ borderWidth: 1, borderColor: "#E9ECF1", borderRadius: 12, overflow: "hidden" }}>
            <View style={{ flexDirection: "row", backgroundColor: "#F9FAFB" }}>
                <Cell flex label="Mahsulot" bold />
                <Cell width={100} label="Miqdor" right bold />
            </View>
            {rows.map((r, i) => (
                <View key={i} style={{ flexDirection: "row" }}>
                    <Cell flex label={r.name} />
                    <Cell width={100} label={String(r.qty)} right />
                </View>
            ))}
        </View>
    );
}

function Cell({
    label,
    bold,
    right,
    width,
    flex,
}: {
    label: string;
    bold?: boolean;
    right?: boolean;
    width?: number;
    flex?: boolean;
}) {
    return (
        <View
            style={{
                width,
                flex: flex ? 1 : undefined,
                borderRightWidth: 1,
                borderColor: "#E9ECF1",
                paddingVertical: 10,
                paddingHorizontal: 10,
            }}
        >
            <Text
                style={{
                    fontWeight: bold ? "800" : "400",
                    textAlign: right ? "right" : "left",
                }}
            >
                {label}
            </Text>
        </View>
    );
}
