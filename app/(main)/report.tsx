// app/(main)/report.tsx
import Toast from "@/components/Toast";
import { exportDashboardPdf } from "@/lib/pdf";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/appStore";
import { useToastStore } from "@/store/toastStore";
import type { MonthlySummary } from "@/types";
import React, { useEffect, useMemo, useState } from "react";
import { Linking, Modal, Pressable, ScrollView, Text, TouchableOpacity, View } from "react-native";

const P = "#770E13";

export default function ReportScreen() {
    // ---- Global stores
    const selectedStoreId = useAppStore((s) => s.currentStoreId);
    const stores = useAppStore((s) => s.stores);
    const allSales = useAppStore((s) => s.sales);
    const allReturns = useAppStore((s) => s.returns);
    const cash = useAppStore((s) => s.cashReceipts);

    const toast = useToastStore();

    // ---- Local UI state
    const [pdfModalOpen, setPdfModalOpen] = useState(false);
    const [pdfLink, setPdfLink] = useState<string | null>(null);
    const [pdfName, setPdfName] = useState<string>("Hisobot.pdf");

    const [month, setMonth] = useState<string>(() => {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });

    const [msRow, setMsRow] = useState<MonthlySummary | null>(null);
    const [msLoading, setMsLoading] = useState(false);

    // ---- Derived helpers
    const storeName = useMemo(
        () => stores.find((s) => String(s.id) === String(selectedStoreId))?.name ?? "",
        [stores, selectedStoreId]
    );

    const inMonth = (t: number | string | Date) => {
        const d = new Date(t as any);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        return key === month;
    };

    const sales = useMemo(
        () =>
            allSales.filter(
                (x) => String(x.storeId) === String(selectedStoreId) && inMonth(x.created_at)
            ),
        [allSales, selectedStoreId, month]
    );

    const returns = useMemo(
        () =>
            allReturns.filter(
                (x) => String(x.storeId) === String(selectedStoreId) && inMonth(x.created_at)
            ),
        [allReturns, selectedStoreId, month]
    );

    const receipts = useMemo(
        () =>
            cash.filter(
                (x) => String(x.storeId) === String(selectedStoreId) && inMonth(x.created_at)
            ),
        [cash, selectedStoreId, month]
    );

    const localTotalSales = useMemo(
        () => sales.reduce((a, s) => a + s.price * s.qty, 0),
        [sales]
    );
    const localTotalReturns = useMemo(
        () => returns.reduce((a, r) => a + r.price * r.qty, 0),
        [returns]
    );
    const localTotalCash = useMemo(
        () => receipts.reduce((a, r) => a + r.amount, 0),
        [receipts]
    );
    const localDebt = Math.max(localTotalSales - localTotalReturns - localTotalCash, 0);

    const returnsQty = useMemo(
        () => returns.reduce((a, r) => a + r.qty, 0),
        [returns]
    );

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
        for (const r of returns) map.set(r.productName, (map.get(r.productName) ?? 0) + r.qty);
        return Array.from(map.entries())
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty);
    }, [returns]);

    const money = (n: number) => `${(n || 0).toLocaleString()} so‘m`;

    // ---- Summary fetcher
    const fetchSummary = async () => {
        if (!selectedStoreId) return;
        setMsLoading(true);
        try {
            const { data, error } = await supabase
                .from("monthly_store_summary")
                .select("store_id, ym, total_sales, total_returns, total_cash, delta, debt_raw, debt")
                .eq("ym", month)
                .eq("store_id", selectedStoreId)
                .maybeSingle();

            if (error) setMsRow(null);
            else setMsRow((data as any) ?? null);
        } finally {
            setMsLoading(false);
        }
    };

    // Month yoki store o‘zgarsa summary-ni yangilaymiz
    useEffect(() => {
        fetchSummary();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedStoreId, month]);

    // ---- Early return (hooklar yuqorida aniq chaqirildi, xavfsiz)
    if (!selectedStoreId) {
        return (
            <View style={{ padding: 16 }}>
                <Text style={{ fontWeight: "800" }}>Iltimos, tepada do‘konni tanlang.</Text>
            </View>
        );
    }

    const exportPdf = async () => {
        toast.showLoading("Hisobot tayyorlanmoqda…", 0);
        try {
            const totals = {
                totalSales: msRow?.total_sales ?? localTotalSales,
                totalCash: msRow?.total_cash ?? localTotalCash,
                debt: msRow?.debt ?? localDebt,
                returnCount: returnsQty,
            };
            const result = await exportDashboardPdf({
                storeName,
                periodLabel: month,
                cards: totals,
                salesRank,
                returnRank,
            });

            setPdfName(result?.name ?? `Hisobot_${storeName || "Store"}_${month}.pdf`);
            setPdfLink(result?.uri ?? null);
            toast.hide();
            setPdfModalOpen(true);
        } catch {
            toast.hide();
        }
    };

    const shiftMonth = (delta: number) => {
        const [y, m] = month.split("-").map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    };

    const viewTotalSales = msRow?.total_sales ?? localTotalSales;
    const viewTotalReturns = msRow?.total_returns ?? localTotalReturns;
    const viewTotalCash = msRow?.total_cash ?? localTotalCash;
    const viewDebt = msRow?.debt_raw ?? localDebt;

    return (
        <>
            <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }}>
                <View style={{ flexDirection: "row", alignItems: "center", marginBottom: 8 }}>
                    <TouchableOpacity onPress={() => shiftMonth(-1)} style={{ padding: 6 }}>
                        <Text style={{ fontWeight: "800" }}>‹</Text>
                    </TouchableOpacity>
                    <Text style={{ fontWeight: "800", fontSize: 16, marginHorizontal: 8 }}>
                        {month}
                        {msLoading ? " …" : ""}
                    </Text>
                    <TouchableOpacity onPress={() => shiftMonth(1)} style={{ padding: 6 }}>
                        <Text style={{ fontWeight: "800" }}>›</Text>
                    </TouchableOpacity>

                    <View style={{ flex: 1 }} />
                    <TouchableOpacity
                        onPress={exportPdf}
                        style={{ backgroundColor: P, paddingVertical: 10, paddingHorizontal: 12, borderRadius: 10 }}
                    >
                        <Text style={{ color: "#fff", fontWeight: "800" }}>PDF</Text>
                    </TouchableOpacity>
                </View>

                <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1, gap: 12 }}>
                        <StatCard title="Umumiy summa" value={money(viewTotalSales)} />
                        <StatCard title="Qarz" value={money(viewDebt)} />
                    </View>
                    <View style={{ flex: 1, gap: 12 }}>
                        <StatCard title="Olingan summa" value={money(viewTotalCash)} />
                        <StatCard title="Vazvrat (miqdor)" value={String(returnsQty)} />
                    </View>
                </View>

                <View style={{ height: 14 }} />
                <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 6 }}>Sotuv reytingi</Text>
                <RankTableSales rows={salesRank} />

                <View style={{ height: 16 }} />
                <Text style={{ fontSize: 18, fontWeight: "800", marginBottom: 6 }}>Vazvrat reytingi</Text>
                <RankTableReturns rows={returnRank} />
            </ScrollView>

            {/* PDF modal */}
            <PdfModal
                open={pdfModalOpen}
                onClose={() => setPdfModalOpen(false)}
                pdfLink={pdfLink}
                pdfName={pdfName}
                month={month}
                storeName={storeName}
            />

            <Toast />
        </>
    );
}

/** --- Presentational components --- */
function StatCard({ title, value }: { title: string; value: string }) {
    return (
        <View style={{ backgroundColor: "#fff", borderWidth: 1, borderColor: "#E9ECF1", borderRadius: 16, padding: 14 }}>
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
            <Text style={{ fontWeight: bold ? "800" : "400", textAlign: right ? "right" : "left" }}>{label}</Text>
        </View>
    );
}

function PdfModal({
    open,
    onClose,
    pdfLink,
    pdfName,
    month,
    storeName,
}: {
    open: boolean;
    onClose: () => void;
    pdfLink: string | null;
    pdfName: string;
    month: string;
    storeName: string;
}) {
    const openPdfExternal = async () => {
        if (!pdfLink) return;
        try {
            const url = encodeURI(pdfLink);
            await Linking.openURL(url);
        } catch { }
    };
    return (
        <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
            <Pressable
                onPress={onClose}
                style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.2)", justifyContent: "center", padding: 24 }}
            >
                <View
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
                        Quyidagi havola — tanlagan davrdagi ({month}) “{storeName || "Do‘kon"}” uchun PDF hisobot.
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

                        <TouchableOpacity disabled={!pdfLink} onPress={openPdfExternal} activeOpacity={0.7}>
                            <Text
                                style={{ color: pdfLink ? "#2563EB" : "#94A3B8", marginTop: 6, textDecorationLine: "underline" }}
                                numberOfLines={2}
                            >
                                {String(pdfLink ?? "Havola topilmadi")}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={{ flexDirection: "row", gap: 10, marginTop: 14, justifyContent: "flex-end" }}>
                        <TouchableOpacity
                            onPress={onClose}
                            style={{ paddingVertical: 12, paddingHorizontal: 16, borderRadius: 12, backgroundColor: "#F3F4F6" }}
                        >
                            <Text style={{ fontWeight: "800" }}>Yopish</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Pressable>
        </Modal>
    );
}
