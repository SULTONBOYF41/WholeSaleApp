// app/(main)/admin/summary.tsx
import { Button, C, Card, H1, H2, Select } from "@/components/UI";
import { exportMonthlySummaryPdf } from "@/lib/pdf";
import { useAppStore } from "@/store/appStore";
import { useExpensesStore } from "@/store/expensesStore";
import { useSyncStore } from "@/store/syncStore";
import * as FileSystem from "expo-file-system";
import * as FileSystemLegacy from "expo-file-system/legacy";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Platform, ScrollView, Text, TouchableOpacity, View } from "react-native";

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

function ymOf(ts: number | string | Date) {
    const d = new Date(ts as any);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function inMonth(ts: number | string, ym: string) {
    return ymOf(ts) === ym;
}

/** Qarzni oyma-oy ko‘chirib (carry) hisoblash: shu oyga qadar jami net */
function computeDebtWithCarry(
    allSales: { storeId: any; created_at: any; qty: number; price: number }[],
    allReturns: { storeId: any; created_at: any; qty: number; price: number }[],
    allCash: { storeId: any; created_at: any; amount: number }[],
    month: string,
    storeId: string | number
) {
    const sid = String(storeId);

    const salesUpTo = allSales
        .filter((x) => String(x.storeId) === sid && ymOf(x.created_at) <= month)
        .reduce((a, s) => a + (s.qty || 0) * (s.price || 0), 0);

    const returnsUpTo = allReturns
        .filter((x) => String(x.storeId) === sid && ymOf(x.created_at) <= month)
        .reduce((a, r) => a + (r.qty || 0) * (r.price || 0), 0);

    const cashUpTo = allCash
        .filter((x) => String(x.storeId) === sid && ymOf(x.created_at) <= month)
        .reduce((a, r) => a + (r.amount || 0), 0);

    return Math.max(salesUpTo - returnsUpTo - cashUpTo, 0);
}

export default function SummaryScreen() {
    const router = useRouter();

    const stores = useAppStore((s) => s.stores);
    const salesAll = useAppStore((s) => s.sales) as any[];
    const returnsAll = useAppStore((s) => s.returns) as any[];
    const cashAll = useAppStore((s) => s.cashReceipts) as any[];
    const pullNow = useAppStore((s) => s.pullNow);

    const { items: expenses, fetchAll: fetchExpenses } = useExpensesStore();

    const online = useSyncStore((s) => s.online);

    const monthOpts = useMemo(() => monthOptions(24), []);
    const [month, setMonth] = useState<string>(monthOpts[0]?.value!);

    // expenses local load
    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

    // online polling: summary yangilanishi uchun
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    useEffect(() => {
        if (online) {
            pullNow().catch(() => { });
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
    }, [online, pullNow]);

    // Per-store rows (local hisob)
    type Row = {
        storeId: string;
        storeName: string;
        totalSales: number;
        totalReturns: number;
        totalCash: number;
        debt: number;
    };

    const rows: Row[] = useMemo(() => {
        const nameById = new Map(stores.map((s) => [String(s.id), s.name]));

        const storeIds = stores.map((s) => String(s.id));

        return storeIds
            .map((sid) => {
                const sales = salesAll
                    .filter((x) => String(x.storeId) === sid && inMonth(x.created_at, month))
                    .reduce((a, s) => a + Number(s.qty || 0) * Number(s.price || 0), 0);

                const ret = returnsAll
                    .filter((x) => String(x.storeId) === sid && inMonth(x.created_at, month))
                    .reduce((a, r) => a + Number(r.qty || 0) * Number(r.price || 0), 0);

                const cash = cashAll
                    .filter((x) => String(x.storeId) === sid && inMonth(x.created_at, month))
                    .reduce((a, c) => a + Number(c.amount || 0), 0);

                const debt = computeDebtWithCarry(salesAll, returnsAll, cashAll, month, sid);

                return {
                    storeId: sid,
                    storeName: nameById.get(sid) ?? "—",
                    totalSales: sales,
                    totalReturns: ret,
                    totalCash: cash,
                    debt,
                };
            })
            .sort((a, b) => a.storeName.localeCompare(b.storeName));
    }, [stores, salesAll, returnsAll, cashAll, month]);

    // --- do‘kon (shop) xarajatlari
    const sumExpensesMonth = useMemo(() => {
        let s = 0;
        for (const e of expenses) {
            if (!inMonth((e as any).created_at, month)) continue;
            const kind = String((e as any).kind ?? "").toLowerCase();
            if (kind !== "shop") continue;
            const amount = Number((e as any).amount ?? (Number((e as any).qty ?? 0) * Number((e as any).price ?? 0))) || 0;
            s += amount;
        }
        return s;
    }, [expenses, month]);

    // --- bank + oilaviy
    const sumOtherExpensesMonth = useMemo(() => {
        let s = 0;
        for (const e of expenses) {
            if (!inMonth((e as any).created_at, month)) continue;
            const kind = String((e as any).kind ?? "").toLowerCase();
            if (kind !== "bank" && kind !== "family") continue;
            const amount = Number((e as any).amount ?? (Number((e as any).qty ?? 0) * Number((e as any).price ?? 0))) || 0;
            s += amount;
        }
        return s;
    }, [expenses, month]);

    const totals = useMemo(() => {
        const t = { sales: 0, returns: 0, cash: 0, debt: 0 };
        for (const r of rows) {
            t.sales += r.totalSales;
            t.returns += r.totalReturns;
            t.cash += r.totalCash;
            t.debt += r.debt;
        }
        const netProfit = t.sales - t.returns - sumExpensesMonth;
        return {
            ...t,
            expenses: sumExpensesMonth,
            otherExpenses: sumOtherExpensesMonth,
            netProfit,
        };
    }, [rows, sumExpensesMonth, sumOtherExpensesMonth]);

    const netProfitColor = totals.netProfit > 0 ? "#10B981" : totals.netProfit < 0 ? "#EF4444" : C.text;

    const remaining = useMemo(() => totals.netProfit - (totals.otherExpenses || 0), [totals.netProfit, totals.otherExpenses]);
    const remainingBg = remaining > 0 ? "#10B981" : remaining < 0 ? "#EF4444" : "#6B7280";
    const remainingText = "#FFFFFF";

    // PDF
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
                    otherExpenses: totals.otherExpenses,
                    remaining: remaining,
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
            await Sharing.shareAsync(pdfUri, { mimeType: "application/pdf", dialogTitle: pdfName || "Hisobot" });
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
        router.push({
            pathname: "/(main)/admin/report-viewer",
            params: { uri: encodeURIComponent(pdfUri), title: pdfName },
        });
    };

    // download
    const hasSAF =
        Platform.OS === "android" &&
        // @ts-ignore
        !!FileSystem.StorageAccessFramework &&
        typeof (FileSystem as any).StorageAccessFramework.requestDirectoryPermissionsAsync === "function";

    const onDownload = async () => {
        if (!pdfUri) return;
        try {
            if (hasSAF) {
                const saf = (FileSystem as any).StorageAccessFramework;
                const perm = await saf.requestDirectoryPermissionsAsync();
                if (!perm.granted) {
                    alert("Ruxsat berilmadi.");
                    return;
                }
                const name = (pdfName || "Hisobot").toString().replace(/\.pdf$/i, "");
                const outUri = await saf.createFileAsync(perm.directoryUri, name, "application/pdf");
                const b64 = await FileSystemLegacy.readAsStringAsync(pdfUri, {
                    encoding: FileSystemLegacy.EncodingType.Base64,
                });
                await FileSystem.writeAsStringAsync(outUri, b64, { encoding: "base64" as any });
                alert("Fayl yuklab olindi.");
            } else {
                await Sharing.shareAsync(pdfUri, { mimeType: "application/pdf", dialogTitle: pdfName || "Hisobot" });
            }
        } catch (e) {
            console.warn("download error", e);
            alert("Yuklab olishda xatolik yuz berdi.");
        }
    };

    const fmt = (n: number) => (n || 0).toLocaleString();

    return (
        <ScrollView contentContainerStyle={{ padding: 16 }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <H1 style={{ flex: 1 }}>Umumiy Hisobot</H1>
                <Button title={creatingPdf ? "PDF tayyorlanmoqda…" : "PDF yaratish"} onPress={createPdf} disabled={creatingPdf} style={{ minWidth: 160 }} />
            </View>

            <H2 style={{ marginTop: 12 }}>Oy tanlang</H2>
            <Select value={month} onChange={setMonth} options={monthOpts} style={{ marginTop: 6 }} />

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

            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                <Card style={{ flex: 1 }}>
                    <Text style={{ color: C.muted, fontWeight: "800" }}>Umumiy xarajat (faqat do‘kon)</Text>
                    <Text style={{ fontSize: 18, fontWeight: "900", marginTop: 6 }}>{fmt(totals.expenses)} so‘m</Text>
                </Card>
                <Card style={{ flex: 1 }}>
                    <Text style={{ color: C.muted, fontWeight: "800" }}>Sof foyda</Text>
                    <Text style={{ fontSize: 18, fontWeight: "900", marginTop: 6, color: netProfitColor }}>
                        {fmt(totals.netProfit)} so‘m
                    </Text>
                </Card>
            </View>

            <View style={{ flexDirection: "row", gap: 12, marginTop: 12 }}>
                <Card style={{ flex: 1 }}>
                    <Text style={{ color: C.muted, fontWeight: "800" }}>Qolgan xarajatlar (bank + oilaviy)</Text>
                    <Text style={{ fontSize: 18, fontWeight: "900", marginTop: 6 }}>{fmt(totals.otherExpenses || 0)} so‘m</Text>
                </Card>

                <Card style={{ flex: 1, backgroundColor: remainingBg, borderColor: "transparent" }}>
                    <Text style={{ color: "#fff", fontWeight: "800" }}>Qolgan pul</Text>
                    <Text style={{ fontSize: 18, fontWeight: "900", marginTop: 6, color: remainingText }}>
                        {fmt(remaining)} so‘m
                    </Text>
                </Card>
            </View>

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

                    <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                        <Button title="Bekor qilish" onPress={() => setPdfUri(null)} tone="neutral" style={{ flex: 1 }} />
                        <Button title="Yuklab olish" onPress={onDownload} style={{ flex: 1 }} />
                    </View>
                </Card>
            )}
        </ScrollView>
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
