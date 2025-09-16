// app/(main)/admin/summary.tsx
import { Button, C, Card, H1, H2, Select } from "@/components/UI";
import { exportMonthlySummaryPdf } from "@/lib/pdf";
import { supabase } from "@/lib/supabase";
import { useAppStore } from "@/store/appStore";
import { useExpensesStore } from "@/store/expensesStore";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

/** Oylar ro'yxati (scroll Select uchun) */
function monthOptions(lastN = 24) {
    const now = new Date();
    const arr: { label: string; value: string }[] = [];
    for (let i = 0; i < lastN; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleString(undefined, { year: "numeric", month: "long" });
        arr.push({ label, value: val });
    }
    return arr;
}
function inMonth(ts: number | string, ym: string) {
    const d = new Date(ts);
    const [y, m] = ym.split("-").map(Number);
    return d.getFullYear() === y && d.getMonth() + 1 === m;
}

type MSSRow = {
    ym: string;
    store_id: string;
    total_sales: number;
    total_returns: number;
    total_cash: number;
    debt: number;
};

export default function SummaryScreen() {
    const router = useRouter();

    // UI ma'lumotlari
    const stores = useAppStore((s) => s.stores);
    const expenses = useExpensesStore((s) => s.items); // global xarajatlar

    // Oy tanlash
    const monthOpts = useMemo(() => monthOptions(24), []);
    const [month, setMonth] = useState(monthOpts[0]?.value);

    // Serverdan monthly_store_summary o‘qish
    const [mss, setMss] = useState<MSSRow[]>([]);
    const [loadingServer, setLoadingServer] = useState(false);

    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoadingServer(true);
            try {
                let { data, error } = await supabase
                    .from("monthly_store_summary")
                    .select("*")
                    .eq("ym", month);

                if (!error && (data?.length ?? 0) === 0) {
                    await supabase.rpc("recompute_monthly_summary", { _ym: month });
                    const second = await supabase
                        .from("monthly_store_summary")
                        .select("*")
                        .eq("ym", month);
                    data = second.data ?? [];
                }

                if (!mounted) return;
                setMss((data ?? []) as MSSRow[]);
            } finally {
                if (mounted) setLoadingServer(false);
            }
        })();
        return () => {
            mounted = false;
        };
    }, [month]);

    // Har do‘kon uchun qatordagi ko‘rsatkichlar (serverdan)
    type Row = {
        storeId: string;
        storeName: string;
        totalSales: number;
        totalReturns: number;
        totalCash: number; // Tushum
        debt: number; // (server hisoblagani)
    };

    const rows: Row[] = useMemo(() => {
        const nameById = new Map(stores.map((s) => [s.id, s.name]));
        return (mss || [])
            .map((r) => ({
                storeId: r.store_id,
                storeName: nameById.get(r.store_id) ?? "—",
                totalSales: Number(r.total_sales || 0),
                totalReturns: Number(r.total_returns || 0),
                totalCash: Number(r.total_cash || 0),
                debt: Number(r.debt || 0),
            }))
            .sort((a, b) => a.storeName.localeCompare(b.storeName));
    }, [mss, stores]);

    // Global xarajatlar (oy kesimida, store’ga bog‘lanmagan)
    const sumExpensesMonth = useMemo(() => {
        let s = 0;
        for (const e of expenses) {
            if (!inMonth(e.created_at, month)) continue;
            s += Number(e.amount || 0);
        }
        return s;
    }, [expenses, month]);

    // Jami satrlar (serverdan kelgan yig‘indi) + sof foyda
    const totals = useMemo(() => {
        const t = { sales: 0, returns: 0, cash: 0, debt: 0 };
        for (const r of rows) {
            t.sales += r.totalSales;
            t.returns += r.totalReturns;
            t.cash += r.totalCash;
            t.debt += r.debt;
        }
        const netProfit = (t.sales - t.returns) - sumExpensesMonth; // xarajat global
        return { ...t, expenses: sumExpensesMonth, netProfit };
    }, [rows, sumExpensesMonth]);

    // Sof foyda rangi (ijobiy: yashil, manfiy: qizil, 0: neytral)
    const netProfitColor =
        totals.netProfit > 0 ? "#10B981" : totals.netProfit < 0 ? "#EF4444" : C.text;

    // PDF holati
    const [creatingPdf, setCreatingPdf] = useState(false);
    const [pdfUri, setPdfUri] = useState<string | null>(null);
    const [pdfName, setPdfName] = useState<string>(() => `Umumiy_${month}.pdf`);

    const createPdf = async () => {
        setCreatingPdf(true);
        try {
            const res = await exportMonthlySummaryPdf({
                ym: month,
                rows: rows.map((r) => ({
                    storeName: r.storeName,
                    totalSales: r.totalSales,
                    totalReturns: r.totalReturns,
                    totalCash: r.totalCash,
                    debt: r.debt,
                })),
                totals: {
                    sales: totals.sales,
                    returns: totals.returns,
                    cash: totals.cash,
                    debt: totals.debt,
                    expenses: totals.expenses,
                    netProfit: totals.netProfit,
                },
                source: "summary",
                fileName: `Umumiy_${month}.pdf`,
            });
            setPdfName(res.name);
            setPdfUri(res.uri);
        } finally {
            setCreatingPdf(false);
        }
    };

    const onShare = async () => {
        if (!pdfUri) return;
        try {
            await Sharing.shareAsync(pdfUri, { mimeType: "application/pdf", dialogTitle: pdfName });
        } catch { }
    };
    const onOpenExternal = async () => {
        if (!pdfUri) return;
        try {
            await Linking.openURL(pdfUri);
        } catch { }
    };
    const openFullScreen = () => {
        if (!pdfUri) return;
        router.push({ pathname: "/(main)/admin/report-viewer", params: { uri: pdfUri, title: pdfName } });
    };

    const fmt = (n: number) => (n || 0).toLocaleString();

    return (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <H1 style={{ flex: 1 }}>
                    Umumiy Hisobot{loadingServer ? " …" : ""}
                </H1>
                <Button
                    title={creatingPdf ? "PDF tayyorlanmoqda…" : "PDF yaratish"}
                    onPress={createPdf}
                    disabled={creatingPdf}
                    style={{ minWidth: 160 }}
                />
            </View>

            <H2 style={{ marginTop: 12 }}>Oy tanlang</H2>
            <Select value={month} onChange={setMonth} options={monthOpts} style={{ marginTop: 6 }} />

            {/* Jadval — horizontal scroll bilan */}
            <Card style={{ marginTop: 12, padding: 0 }}>
                <ScrollView horizontal showsHorizontalScrollIndicator contentContainerStyle={{ minWidth: 760 }}>
                    <View style={{ width: "100%" }}>
                        <View style={{ flexDirection: "row", backgroundColor: "#F9FAFB", borderBottomWidth: 1, borderColor: C.border }}>
                            <Cell label="Do'kon" bold flex />
                            <Cell label="Sotuv" bold right width={140} />
                            <Cell label="Qaytarish" bold right width={140} />
                            <Cell label="Tushum" bold right width={140} />
                            <Cell label="Qarz" bold right width={140} />
                        </View>

                        {rows.length === 0 ? (
                            <View style={{ padding: 14 }}>
                                <Text style={{ color: C.muted }}>Tanlangan oyda ma'lumot yo‘q</Text>
                            </View>
                        ) : (
                            rows.map((r) => (
                                <View key={r.storeId} style={{ flexDirection: "row", borderTopWidth: 1, borderColor: C.border }}>
                                    <Cell label={r.storeName} flex />
                                    <Cell label={fmt(r.totalSales)} right width={140} />
                                    <Cell label={fmt(r.totalReturns)} right width={140} />
                                    <Cell label={fmt(r.totalCash)} right width={140} />
                                    <Cell label={fmt(r.debt)} right width={140} />
                                </View>
                            ))
                        )}

                        {/* Jami (server summalari) */}
                        <View style={{ flexDirection: "row", borderTopWidth: 2, borderColor: "#EAB308", backgroundColor: "#FEF3C7" }}>
                            <Cell label="Jami" bold flex />
                            <Cell label={fmt(totals.sales)} right bold width={140} />
                            <Cell label={fmt(totals.returns)} right bold width={140} />
                            <Cell label={fmt(totals.cash)} right bold width={140} />
                            <Cell label={fmt(totals.debt)} right bold width={140} />
                        </View>
                    </View>
                </ScrollView>
            </Card>

            {/* Global xarajat va sof foyda ko‘rsatkichlari */}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                <Card style={{ flex: 1 }}>
                    <Text style={{ color: C.muted, fontWeight: "800" }}>Umumiy xarajat</Text>
                    <Text style={{ fontSize: 18, fontWeight: "900", marginTop: 6 }}>{fmt(totals.expenses)} so‘m</Text>
                </Card>
                <Card style={{ flex: 1 }}>
                    <Text style={{ color: C.muted, fontWeight: "800" }}>Sof foyda</Text>
                    <Text
                        style={{
                            fontSize: 18,
                            fontWeight: "900",
                            marginTop: 6,
                            color: netProfitColor, // << ijobiy/yomon rang
                        }}
                    >
                        {fmt(totals.netProfit)} so‘m
                    </Text>
                </Card>
            </View>

            {/* PDF natijasi: link + tugmalar (2 ta) + bekor qilish */}
            {pdfUri && (
                <Card style={{ marginTop: 12 }}>
                    <Text style={{ fontWeight: "900" }}>{pdfName}</Text>
                    <TouchableOpacity onPress={onOpenExternal} activeOpacity={0.7}>
                        <Text style={{ color: "#2563EB", marginTop: 6, textDecorationLine: "underline" }} numberOfLines={2}>
                            {pdfUri}
                        </Text>
                    </TouchableOpacity>

                    <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                        <Button title="Ulashish" onPress={onShare} style={{ flex: 1 }} tone="success" />
                        <Button title="Ochish" onPress={openFullScreen} style={{ flex: 1 }} />
                    </View>

                    <Button
                        title="Bekor qilish"
                        onPress={() => {
                            setPdfUri(null);
                        }}
                        tone="neutral"
                        style={{ marginTop: 10 }}
                    />
                </Card>
            )}
        </ScrollView>
    );
}

/** Kichik yordamchi: jadval katak */
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
                paddingVertical: 10,
                paddingHorizontal: 10,
                borderRightWidth: 1,
                borderColor: C.border,
            }}
        >
            <Text style={{ fontWeight: bold ? "800" : "400", textAlign: right ? "right" : "left", color: C.text }}>
                {label}
            </Text>
        </View>
    );
}
