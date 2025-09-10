import { Button, C, Card, H1, H2, Select } from "@/components/UI";
import { useAppStore } from "@/store/appStore";
import * as FileSystem from "expo-file-system";
import * as Print from "expo-print";
import { useLocalSearchParams } from "expo-router";
import * as Sharing from "expo-sharing";
import React, { useMemo, useState } from "react";
import { Alert, ScrollView, Text, TouchableOpacity, View } from "react-native";

type RankMode = "none" | "sales" | "returns";

function monthOptions(lastN = 12) {
    const now = new Date();
    const arr = [];
    for (let i = 0; i < lastN; i++) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
        const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        const label = d.toLocaleString(undefined, { year: "numeric", month: "long" });
        arr.push({ label, value: val });
    }
    return arr;
}
function inSameMonth(ts: number, ym: string) {
    const d = new Date(ts);
    const [y, m] = ym.split("-").map(Number);
    return d.getFullYear() === y && d.getMonth() + 1 === m;
}

export default function Dashboard() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const stores = useAppStore((s) => s.stores);
    const allSales = useAppStore((s) => s.sales);
    const allReturns = useAppStore((s) => s.returns);
    const cash = useAppStore((s) => s.cashReceipts);

    const store = stores.find((s) => s.id === id);

    // Oy filtri
    const opts = useMemo(() => monthOptions(18), []);
    const [month, setMonth] = useState(opts[0]?.value);

    // Faqat shu store’ga tegishli yozuvlar
    const sales = useMemo(
        () => allSales.filter((x) => x.storeId === id && (!month || inSameMonth(x.created_at, month))),
        [allSales, id, month]
    );
    const returns = useMemo(
        () =>
            allReturns.filter((x) => x.storeId === id && (!month || inSameMonth(x.created_at, month))),
        [allReturns, id, month]
    );
    const receipts = useMemo(
        () => cash.filter((x) => x.storeId === id && (!month || inSameMonth(x.created_at, month))),
        [cash, id, month]
    );

    const totalSales = useMemo(
        () => sales.reduce((a, s) => a + s.price * s.qty, 0),
        [sales]
    );
    const totalCash = useMemo(
        () => receipts.reduce((a, r) => a + r.amount, 0),
        [receipts]
    );
    const totalReturns = useMemo(
        () => returns.reduce((a, r) => a + r.price * r.qty, 0),
        [returns]
    );

    // Qarz — faqat umumiy sotuv - olingan pul (vazvrat qarzni kamaytirmaydi)
    const debt = Math.max(totalSales - totalCash, 0);

    // Reytinglar
    const salesRank = useMemo(() => {
        const m = new Map<string, { qty: number; sum: number }>();
        for (const s of sales) {
            const v = m.get(s.productName) ?? { qty: 0, sum: 0 };
            v.qty += s.qty;
            v.sum += s.qty * s.price;
            m.set(s.productName, v);
        }
        return [...m.entries()]
            .map(([name, v]) => ({ name, qty: v.qty, sum: v.sum }))
            .sort((a, b) => b.sum - a.sum);
    }, [sales]);

    const returnRank = useMemo(() => {
        const m = new Map<string, number>();
        for (const r of returns) {
            m.set(r.productName, (m.get(r.productName) ?? 0) + r.qty);
        }
        return [...m.entries()]
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty);
    }, [returns]);

    const [rankMode, setRankMode] = useState<RankMode>("none");
    const toggleRank = (mode: RankMode) =>
        setRankMode((cur) => (cur === mode ? "none" : mode));

    const makePdfHtml = () => {
        const storeName = store?.name ?? "Do‘kon/Filial";
        const monthLabel = opts.find((o) => o.value === month)?.label ?? "";
        return `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>Hisobot</title>
          <style>
            body { font-family: -apple-system, Roboto, Arial, sans-serif; padding: 20px; }
            h1 { margin: 0 0 8px 0; }
            h2 { margin: 18px 0 6px 0; }
            .card { border: 1px solid #eee; border-radius: 12px; padding: 12px; margin-top: 8px; }
            .row { display: flex; justify-content: space-between; }
            .muted { color: #6B7280; }
          </style>
        </head>
        <body>
          <h1>Hisobot — ${storeName}</h1>
          <div class="muted">${monthLabel}</div>
          <div class="card"><div class="row"><div>Umumiy summa</div><div><b>${totalSales.toLocaleString()}</b> so‘m</div></div></div>
          <div class="card"><div class="row"><div>Olingan summa</div><div><b>${totalCash.toLocaleString()}</b> so‘m</div></div></div>
          <div class="card"><div class="row"><div>Qarz</div><div><b>${debt.toLocaleString()}</b> so‘m</div></div></div>
          <div class="card"><div class="row"><div>Vazvrat (soni)</div><div><b>${returns.length}</b> ta</div></div></div>
          <h2>Izoh</h2>
          <div class="muted">Qarz = Umumiy sotuv – Olingan pul (vazvrat qarzni kamaytirmaydi).</div>
        </body>
      </html>
    `;
    };

    const downloadPdf = async () => {
        try {
            const { uri } = await Print.printToFileAsync({ html: makePdfHtml() });
            const dest =
                FileSystem.documentDirectory +
                `hisobot-${store?.name ?? "store"}-${month}.pdf`;
            await FileSystem.copyAsync({ from: uri, to: dest });
            const canShare = await Sharing.isAvailableAsync();
            if (canShare) await Sharing.shareAsync(dest);
            else Alert.alert("PDF tayyor", "Fayl saqlandi: " + dest);
        } catch (e: any) {
            Alert.alert("Xato", e?.message ?? "PDF yaratishda xato");
        }
    };

    return (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 24 }}>
            <H1>Ҳисоботлар</H1>

            {/* Oy bo‘yicha filtr + PDF yuklash */}
            <View style={{ marginTop: 10, flexDirection: "row", gap: 8 }}>
                <View style={{ flex: 1 }}>
                    <H2>Ой бўйича фильтр</H2>
                    <Select value={month} onChange={setMonth} options={opts} style={{ marginTop: 6 }} />
                </View>
                <View style={{ width: 140, alignSelf: "flex-end" }}>
                    <Button title="PDF юклаш" onPress={downloadPdf} />
                </View>
            </View>

            {/* 2×2 kartalar — responsive grid */}
            <View
                style={{
                    marginTop: 12,
                    flexDirection: "row",
                    flexWrap: "wrap",
                    justifyContent: "space-between",
                    rowGap: 10,
                }}
            >
                {/* Umumiy summa — bosilsa sotuv reytingi */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => toggleRank("sales")}
                    style={{ width: "48%" }}
                >
                    <Card style={{ padding: 14 }}>
                        <Text style={{ color: C.muted, fontWeight: "800" }}>Umumiy summa</Text>
                        <Text style={{ marginTop: 6, fontSize: 22, fontWeight: "900" }}>
                            {totalSales.toLocaleString()} so'm
                        </Text>
                    </Card>
                </TouchableOpacity>

                {/* Olingan summa */}
                <View style={{ width: "48%" }}>
                    <Card style={{ padding: 14 }}>
                        <Text style={{ color: C.muted, fontWeight: "800" }}>Olingan summa</Text>
                        <Text style={{ marginTop: 6, fontSize: 22, fontWeight: "900" }}>
                            {totalCash.toLocaleString()} so'm
                        </Text>
                    </Card>
                </View>

                {/* Qarz */}
                <View style={{ width: "48%" }}>
                    <Card style={{ padding: 14, marginTop: 6 }}>
                        <Text style={{ color: C.muted, fontWeight: "800" }}>Qarz</Text>
                        <Text style={{ marginTop: 6, fontSize: 22, fontWeight: "900" }}>
                            {debt.toLocaleString()} so'm
                        </Text>
                    </Card>
                </View>

                {/* Vazvrat — bosilsa vazvrat reytingi */}
                <TouchableOpacity
                    activeOpacity={0.9}
                    onPress={() => toggleRank("returns")}
                    style={{ width: "48%" }}
                >
                    <Card style={{ padding: 14, marginTop: 6 }}>
                        <Text style={{ color: C.muted, fontWeight: "800" }}>
                            Vazvrat (miqdor)
                        </Text>
                        <Text style={{ marginTop: 6, fontSize: 22, fontWeight: "900" }}>
                            {returns.length}
                        </Text>
                    </Card>
                </TouchableOpacity>
            </View>

            {/* Reytinglar (PDF pastida) */}
            {rankMode !== "none" && (
                <Card style={{ padding: 14, marginTop: 12 }}>
                    <Text style={{ fontWeight: "800", color: C.text }}>
                        {rankMode === "sales" ? "Сотув рейтинги" : "Вазврат рейтинги"}
                    </Text>

                    {rankMode === "sales" ? (
                        salesRank.length === 0 ? (
                            <Text style={{ color: C.muted, marginTop: 8 }}>Reyting бўш</Text>
                        ) : (
                            salesRank.map((it, idx) => (
                                <View
                                    key={it.name}
                                    style={{
                                        flexDirection: "row",
                                        justifyContent: "space-between",
                                        paddingVertical: 8,
                                        borderTopWidth: idx === 0 ? 0 : 1,
                                        borderColor: "#F0F0F0",
                                    }}
                                >
                                    <View style={{ flex: 1, paddingRight: 8 }}>
                                        <Text style={{ fontWeight: "700" }}>{it.name}</Text>
                                        <Text style={{ color: C.muted, marginTop: 2 }}>
                                            {it.qty} dona
                                        </Text>
                                    </View>
                                    <Text style={{ fontWeight: "800" }}>
                                        {it.sum.toLocaleString()} so‘m
                                    </Text>
                                </View>
                            ))
                        )
                    ) : returnRank.length === 0 ? (
                        <Text style={{ color: C.muted, marginTop: 8 }}>Reyting бўш</Text>
                    ) : (
                        returnRank.map((it, idx) => (
                            <View
                                key={it.name}
                                style={{
                                    flexDirection: "row",
                                    justifyContent: "space-between",
                                    paddingVertical: 8,
                                    borderTopWidth: idx === 0 ? 0 : 1,
                                    borderColor: "#F0F0F0",
                                }}
                            >
                                <Text style={{ fontWeight: "700" }}>{it.name}</Text>
                                <Text style={{ fontWeight: "800" }}>{it.qty} dona</Text>
                            </View>
                        ))
                    )}
                </Card>
            )}
        </ScrollView>
    );
}
