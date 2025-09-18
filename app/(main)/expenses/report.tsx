// app/(main)/expenses/report.tsx
import { ReportCards } from "@/components/expenses/ReportCards";
import { Button, H2 } from "@/components/UI";
import { supabase } from "@/lib/supabase";
import { useExpensesStore } from "@/store/expensesStore";
import { useSyncStore } from "@/store/syncStore";
import * as Print from "expo-print";
import { router, useFocusEffect } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { RefreshControl, ScrollView, View } from "react-native";

const PRIMARY = "#770E13";

export default function ReportScreen() {
    const { fetchAll, loading, totals } = useExpensesStore();
    const online = useSyncStore((s) => s.online);

    const [exporting, setExporting] = useState(false);
    const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

    const safeTotals = useMemo(() => {
        const tObj: Partial<{ family: number; shop: number; bank: number; total: number }> = totals ?? {};
        const f = Number(tObj.family ?? 0);
        const s = Number(tObj.shop ?? 0);
        const b = Number(tObj.bank ?? 0);
        const t = Number(tObj.total ?? f + s + b);
        return { family: f, shop: s, bank: b, total: t };
    }, [totals]);

    const onGoFamily = () => router.replace("/(main)/expenses/family");
    const onGoShop = () => router.replace("/(main)/expenses/shop");
    const onGoBank = () => router.replace("/(main)/expenses/bank");

    // Realtime: expenses jadvali o'zgarsa, qayta yuklaymiz
    const subscribeRealtime = useCallback(() => {
        if (channelRef.current) {
            try { supabase.removeChannel(channelRef.current as any); } catch { }
            channelRef.current = null;
        }

        const ch = supabase
            .channel("expenses-realtime-report")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "expenses" },
                () => { fetchAll(); }
            )
            .subscribe();

        channelRef.current = ch;
    }, [fetchAll]);

    // 8s polling (faqat onlaynda)
    const startPolling = useCallback(() => {
        if (pollRef.current) return;
        pollRef.current = setInterval(() => { fetchAll(); }, 8000);
    }, [fetchAll]);

    const stopPolling = useCallback(() => {
        if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null; }
    }, []);

    useFocusEffect(
        useCallback(() => {
            fetchAll();
            subscribeRealtime();
            if (online) startPolling();

            return () => {
                stopPolling();
                if (channelRef.current) {
                    try { supabase.removeChannel(channelRef.current as any); } catch { }
                    channelRef.current = null;
                }
            };
        }, [fetchAll, subscribeRealtime, startPolling, stopPolling, online])
    );

    useEffect(() => {
        if (online) startPolling(); else stopPolling();
    }, [online, startPolling, stopPolling]);

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
<div class="muted">${dt}</div>
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
                    dialogTitle: "Xarajatlar hisobot (PDF)",
                });
            }
        } finally {
            setExporting(false);
        }
    };

    return (
        <ScrollView
            refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAll} />}
            contentContainerStyle={{ paddingBottom: 16 }}
        >
            <View
                style={{
                    paddingHorizontal: 16,
                    paddingTop: 12,
                    flexDirection: "row",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <H2>Xarajatlar — Hisobot</H2>
                <Button
                    title={exporting ? "PDF tayyorlanmoqda..." : "PDF yuklash"}
                    onPress={exportPdf}
                    style={{ backgroundColor: PRIMARY }}
                    disabled={exporting}
                />
            </View>

            <ReportCards
                totals={safeTotals}
                onGoFamily={onGoFamily}
                onGoShop={onGoShop}
                onGoBank={onGoBank}
            />
        </ScrollView>
    );
}
