// app/(main)/expenses/report.tsx
import { ReportCards } from "@/components/expenses/ReportCards";
import { Button, H2, Select } from "@/components/UI";
import { useExpensesStore } from "@/store/expensesStore";
import { useSyncStore } from "@/store/syncStore";
import * as Print from "expo-print";
import { router, useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useMemo, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

const PRIMARY = "#770E13";

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
const toYM = (ts: string | number | Date) => {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

export default function ReportScreen() {
    const { fetchAll, loading, totals, items, batchesByKind } = useExpensesStore();
    const online = useSyncStore((s) => s.online);
    const [exporting, setExporting] = useState(false);

    // Oy tanlash
    const monthOpts = useMemo(() => monthOptions(24), []);
    const [month, setMonth] = useState<string>(monthOpts[0]?.value);

    useFocusEffect(
        useCallback(() => {
            if (online) fetchAll().catch(() => { });
        }, [online, fetchAll])
    );

    // Tanlangan oy bo‘yicha jami (family/shop/bank)
    const monthTotals = useMemo(() => {
        const inMonth = (ts: string) => toYM(ts) === month;

        const sum = (xs: number[]) =>
            xs.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0);

        const family = sum(
            (batchesByKind.family || [])
                .filter((b) => inMonth(b.created_at))
                .map((b) => b.total)
        );
        const shop = sum(
            (batchesByKind.shop || [])
                .filter((b) => inMonth(b.created_at))
                .map((b) => b.total)
        );
        const bank = sum(
            (batchesByKind.bank || [])
                .filter((b) => inMonth(b.created_at))
                .map((b) => b.total)
        );

        return { family, shop, bank, total: family + shop + bank };
    }, [batchesByKind, month]);

    // Ehtiyot uchun (component ichida ishlatiladigan ko‘rinish)
    const safeTotals = useMemo(() => {
        const tObj: Partial<{ family: number; shop: number; bank: number; total: number }> =
            monthTotals ?? totals ?? {};
        const f = Number(tObj.family ?? 0);
        const s = Number(tObj.shop ?? 0);
        const b = Number(tObj.bank ?? 0);
        const t = Number((tObj as any).total ?? f + s + b);
        return { family: f, shop: s, bank: b, total: t };
    }, [monthTotals, totals]);

    const onGoFamily = () => router.replace("/(main)/expenses/family");
    const onGoShop = () => router.replace("/(main)/expenses/shop");
    const onGoBank = () => router.replace("/(main)/expenses/bank");

    const fmt = (n: number) => Number(n || 0).toLocaleString("ru-RU");
    const buildHtml = () => {
        const dt = new Date().toLocaleString();
        return `
<!doctype html><html lang="uz"><head><meta charset="utf-8"/>
<title>Xarajatlar hisobot</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;padding:24px;color:#111827}
h1{margin:0 0 8px;font-size:22px}
.muted{color:#6b7280;font-size:12px}
.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:16px}
.card{border:1px solid #e5e7eb;border-radius:12px;padding:14px}
.title{font-weight:800;font-size:13px;margin-bottom:6px}
.val{font-weight:900;font-size:18px}
.total{background:#fafafa}
</style></head><body>
<h1>Xarajatlar hisobot</h1>
<div class="muted">${dt} — ${month}</div>
<div class="grid">
  <div class="card"><div class="title">Oilaviy</div><div class="val">${fmt(safeTotals.family)} so‘m</div></div>
  <div class="card"><div class="title">Do'kon</div><div class="val">${fmt(safeTotals.shop)} so‘m</div></div>
  <div class="card"><div class="title">Bank</div><div class="val">${fmt(safeTotals.bank)} so‘m</div></div>
  <div class="card total"><div class="title">Жами</div><div class="val">${fmt(safeTotals.total)} so‘m</div></div>
</div>
</body></html>`.trim();
    };

    const exportPdf = async () => {
        try {
            setExporting(true);
            const html = buildHtml();
            const { uri } = await Print.printToFileAsync({ html });
            if (await Sharing.isAvailableAsync()) {
                await Sharing.shareAsync(uri, {
                    mimeType: "application/pdf",
                    dialogTitle: `Xarajatlar hisobot (${month})`,
                });
            }
        } finally {
            setExporting(false);
        }
    };

    const onRefresh = useCallback(() => {
        if (!online) return;
        fetchAll().catch(() => { });
    }, [online, fetchAll]);

    return (
        <ScrollView
            refreshControl={<RefreshControl refreshing={loading} onRefresh={onRefresh} />}
            contentContainerStyle={{ paddingBottom: 16 }}
        >
            <View
                style={{
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    gap: 10,
                }}
            >
                <H2>Xarajatlar — Hisobot</H2>

                {/* Oy tanlang */}
                <Select value={month} onChange={setMonth} options={monthOpts} />

                <View style={{ alignItems: "flex-end" }}>
                    <Button
                        title={exporting ? "PDF tayyorlanmoqda..." : "PDF yuklash"}
                        onPress={exportPdf}
                        style={{ backgroundColor: PRIMARY }}
                        disabled={exporting}
                    />
                </View>
            </View>

            <ReportCards
                totals={safeTotals}
                onGoFamily={onGoFamily}
                onGoShop={onGoShop}
                onGoBank={onGoBank}
            />

            {!online && (
                <View
                    style={{
                        marginHorizontal: 16,
                        marginTop: 8,
                        padding: 10,
                        borderRadius: 10,
                        borderWidth: 1,
                        borderColor: "#FCD34D",
                        backgroundColor: "#FEF3C7",
                    }}
                >
                    <H2 style={{ fontSize: 14 }}>
                        Offline rejim — tarmoqqa ulanganingizda yangilanadi
                    </H2>
                </View>
            )}
        </ScrollView>
    );
}
