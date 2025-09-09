import { C, Card, H1, Select } from "@/components/UI";
import { exportDashboardPDF } from "@/lib/pdf";
import { useAppStore } from "@/store/appStore";
import { useLocalSearchParams } from "expo-router";
import React, { useMemo, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";

type MonthOpt = { label: string; value: string }; // YYYY-MM

function monthRange(ym: string) {
    const [y, m] = ym.split("-").map(Number);
    const start = new Date(y, m - 1, 1).getTime();
    const end = new Date(y, m, 1).getTime() - 1;
    return { start, end };
}
const money = (n: number) => `${Math.round(n).toLocaleString()} so‘m`;

type RatingMode = "sales" | "returns" | null;

export default function Dashboard() {
    const { id } = useLocalSearchParams<{ id: string }>();
    const allSales = useAppStore((s) => s.sales);
    const allReturns = useAppStore((s) => s.returns);
    const cash = useAppStore((s) => s.cashReceipts);
    const stores = useAppStore((s) => s.stores);
    const store = stores.find((s) => s.id === id);

    // Oy filtri
    const now = new Date();
    const defaultYM = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const [ym, setYm] = useState(defaultYM);
    const { start, end } = monthRange(ym);

    const months: MonthOpt[] = useMemo(() => {
        const arr: MonthOpt[] = [];
        const names = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
        const d = new Date();
        for (let i = 0; i < 18; i++) {
            const y = d.getFullYear(), m = d.getMonth() + 1;
            arr.push({ value: `${y}-${String(m).padStart(2, "0")}`, label: `${names[m - 1]} ${y}` });
            d.setMonth(d.getMonth() - 1);
        }
        return arr;
    }, []);

    const sales = useMemo(() => allSales.filter(x => x.storeId === id && x.created_at >= start && x.created_at <= end), [allSales, id, start, end]);
    const returns = useMemo(() => allReturns.filter(x => x.storeId === id && x.created_at >= start && x.created_at <= end), [allReturns, id, start, end]);
    const receipts = useMemo(() => cash.filter(x => x.storeId === id && x.created_at >= start && x.created_at <= end), [cash, id, start, end]);

    const totalSales = useMemo(() => sales.reduce((a, s) => a + s.price * s.qty, 0), [sales]);
    const totalReturnsAmount = useMemo(() => returns.reduce((a, r) => a + r.price * r.qty, 0), [returns]);
    const totalReturnsQty = useMemo(() => returns.reduce((a, r) => a + r.qty, 0), [returns]);
    const totalCash = useMemo(() => receipts.reduce((a, r) => a + r.amount, 0), [receipts]);
    const debt = Math.max(totalSales - totalCash, 0);

    // Reyting (toggle)
    const [rating, setRating] = useState<RatingMode>(null);
    const toggleSalesRating = () => setRating(prev => prev === "sales" ? null : "sales");
    const toggleReturnsRating = () => setRating(prev => prev === "returns" ? null : "returns");

    // Sotuv reytingi: mahsulot -> {qtySum, amtSum}
    const salesRating = useMemo(() => {
        const map = new Map<string, { qty: number; amt: number }>();
        for (const s of sales) {
            const cur = map.get(s.productName) ?? { qty: 0, amt: 0 };
            cur.qty += s.qty;
            cur.amt += s.qty * s.price;
            map.set(s.productName, cur);
        }
        return [...map.entries()]
            .map(([name, v]) => ({ name, qty: v.qty, amt: v.amt }))
            .sort((a, b) => b.amt - a.amt);
    }, [sales]);

    // Vazvrat reytingi: mahsulot -> qty
    const returnRating = useMemo(() => {
        const map = new Map<string, number>();
        for (const r of returns) map.set(r.productName, (map.get(r.productName) ?? 0) + r.qty);
        return [...map.entries()]
            .map(([name, qty]) => ({ name, qty }))
            .sort((a, b) => b.qty - a.qty);
    }, [returns]);

    const exportPDF = async () => {
        await exportDashboardPDF({
            storeName: store?.name ?? "Do'kon",
            ym,
            totalSales,
            totalCash,
            debt,
            totalReturnsQty,
        });
    };

    return (
        <View style={{ flex: 1, padding: 16 }}>
            <H1>Ҳисоботлар</H1>

            {/* Oy bo‘yicha filtr */}
            <View style={{ marginTop: 10 }}>
                <Select value={ym} onChange={setYm} options={months} placeholder="Ойни танланг" />
            </View>

            {/* 4 karta */}
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 12 }}>
                <TouchableOpacity style={{ flexBasis: "48%" }} onPress={toggleSalesRating} activeOpacity={0.8}>
                    <Card style={{ padding: 14, borderColor: rating === "sales" ? C.primary : C.border }}>
                        <Text style={{ color: C.muted, fontSize: 12 }}>Умумий сумма</Text>
                        <Text style={{ fontWeight: "800", fontSize: 18, marginTop: 2 }}>{money(totalSales)}</Text>
                    </Card>
                </TouchableOpacity>

                <Card style={{ flexBasis: "48%", padding: 14 }}>
                    <Text style={{ color: C.muted, fontSize: 12 }}>Олинган сумма</Text>
                    <Text style={{ fontWeight: "800", fontSize: 18, marginTop: 2 }}>{money(totalCash)}</Text>
                </Card>

                <Card style={{ flexBasis: "48%", padding: 14 }}>
                    <Text style={{ color: C.muted, fontSize: 12 }}>Қарз</Text>
                    <Text style={{ fontWeight: "800", fontSize: 18, marginTop: 2 }}>{money(debt)}</Text>
                </Card>

                <TouchableOpacity style={{ flexBasis: "48%" }} onPress={toggleReturnsRating} activeOpacity={0.8}>
                    <Card style={{ padding: 14, borderColor: rating === "returns" ? C.primary : C.border }}>
                        <Text style={{ color: C.muted, fontSize: 12 }}>Возврат (миқдор)</Text>
                        <Text style={{ fontWeight: "800", fontSize: 18, marginTop: 2 }}>{totalReturnsQty}</Text>
                    </Card>
                </TouchableOpacity>
            </View>

            {/* PDF hisoboti tugmasi */}
            <TouchableOpacity
                onPress={exportPDF}
                style={{ marginTop: 14, backgroundColor: C.primary, paddingVertical: 14, borderRadius: 12, alignItems: "center" }}
            >
                <Text style={{ color: "#fff", fontWeight: "800" }}>PDF ҳисобот</Text>
            </TouchableOpacity>

            {/* Reyting bloklari */}
            {rating && (
                <Card style={{ marginTop: 12, padding: 12 }}>
                    <Text style={{ fontWeight: "800", marginBottom: 8 }}>
                        {rating === "sales" ? "Сотувлар рейтинги" : "Возвратлар рейтинги"}
                    </Text>

                    {rating === "sales" ? (
                        salesRating.length === 0 ? (
                            <Text style={{ color: C.muted }}>Reyting bo'sh</Text>
                        ) : (
                            salesRating.map((row, idx) => (
                                <View key={row.name} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
                                    <Text>{idx + 1}. {row.name} — {row.qty}</Text>
                                    <Text style={{ fontWeight: "700" }}>{money(row.amt)}</Text>
                                </View>
                            ))
                        )
                    ) : returnRating.length === 0 ? (
                        <Text style={{ color: C.muted }}>Reyting bo'sh</Text>
                    ) : (
                        returnRating.map((row, idx) => (
                            <View key={row.name} style={{ flexDirection: "row", justifyContent: "space-between", paddingVertical: 6 }}>
                                <Text>{idx + 1}. {row.name}</Text>
                                <Text style={{ fontWeight: "700" }}>{row.qty}</Text>
                            </View>
                        ))
                    )}
                </Card>
            )}
        </View>
    );
}
