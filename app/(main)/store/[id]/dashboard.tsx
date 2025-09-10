// app/(main)/store/[id]/dashboard.tsx
import { exportDashboardPdf } from "@/lib/pdf";
import { useAppStore } from "@/store/appStore";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";

const P = "#770E13";

export default function Dashboard() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const allSales = useAppStore((s) => s.sales);
    const allReturns = useAppStore((s) => s.returns);
    const cash = useAppStore((s) => s.cashReceipts);
    const stores = useAppStore((s) => s.stores);
    const storeName = stores.find((s) => s.id === id)?.name ?? "";

    // Oy bo'yicha filtr (oxirgi 12 oy)
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

    // Reytinglar
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

    const money = (n: number) => (n || 0).toLocaleString() + " so‘m";

    const exportPdf = () =>
        exportDashboardPdf({
            storeName,
            periodLabel: month,
            cards: { totalSales, totalCash, debt, returnCount },
            salesRank,
            returnRank,
        });

    // Oylar selecti juda soddalashtirilgan (chapga/ongga tugma bilan)
    const shiftMonth = (delta: number) => {
        const [y, m] = month.split("-").map(Number);
        const d = new Date(y, m - 1 + delta, 1);
        setMonth(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
    };

    return (
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
    );
}

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
                    <Cell width={120} label={(r.total || 0).toLocaleString()} right />
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
                width: width,
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
