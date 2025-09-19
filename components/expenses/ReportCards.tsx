// components/expenses/ReportCards.tsx
import { C, Card } from "@/components/UI";
import React, { memo, useRef } from "react";
import { Animated, Pressable, StyleSheet, Text, View } from "react-native";

export type ExpenseTotals = {
    family?: number | null;
    shop?: number | null;
    bank?: number | null;
    total?: number | null; // yuborilmasa, family+shop+bank yig'indisi
};

type Props = {
    totals: ExpenseTotals;
    onGoFamily?: () => void;
    onGoShop?: () => void;
    onGoBank?: () => void;
};

const PRIMARY = "#770E13";
const fmt = (n?: number | null) => {
    const v = Number(n ?? 0);
    return v.toLocaleString?.("ru-RU") ?? String(v);
};

const PressableCard: React.FC<{
    title: string;
    value: number;
    tone?: "red" | "green" | "blue" | "neutral";
    onPress?: () => void;
    disabled?: boolean;
}> = ({ title, value, tone = "neutral", onPress, disabled }) => {
    const scale = useRef(new Animated.Value(1)).current;
    const onIn = () => Animated.spring(scale, { toValue: 0.98, useNativeDriver: true }).start();
    const onOut = () => Animated.spring(scale, { toValue: 1, useNativeDriver: true }).start();

    const color = tone === "red" ? PRIMARY : tone === "green" ? "#047857" : tone === "blue" ? "#0E7490" : "#374151";

    return (
        <Animated.View style={{ transform: [{ scale }] }}>
            <Pressable
                onPress={onPress}
                onPressIn={onIn}
                onPressOut={onOut}
                disabled={disabled}
                style={({ pressed }) => [styles.card, { borderColor: pressed ? "#eee" : "#f0f0f0", backgroundColor: "#fff" }]}
            >
                <Text style={[styles.title, { color }]}>{title}</Text>
                <Text style={styles.value}>{fmt(value)} сўм</Text>
            </Pressable>
        </Animated.View>
    );
};

export const ReportCards = memo(function ReportCards({ totals, onGoFamily, onGoShop, onGoBank }: Props) {
    const family = Number(totals.family ?? 0);
    const shop = Number(totals.shop ?? 0);
    const bank = Number(totals.bank ?? 0);
    const total = totals.total != null ? Number(totals.total) : family + shop + bank;

    return (
        <View style={styles.wrap}>
            <PressableCard title="Oilaviy" value={family} tone="red" onPress={onGoFamily} />
            <PressableCard title="Do'kon" value={shop} tone="blue" onPress={onGoShop} />
            <PressableCard title="Bank" value={bank} tone="green" onPress={onGoBank} />
            <Card style={styles.totalCard}>
                <Text style={[styles.title, { color: "#111827" }]}>Жами</Text>
                <Text style={[styles.value, { color: "#111827" }]}>{fmt(total)} сўм</Text>
            </Card>
        </View>
    );
});

const styles = StyleSheet.create({
    wrap: { padding: 16, paddingTop: 12, flexDirection: "column", gap: 12 },
    card: {
        width: "100%", borderRadius: 14, borderWidth: 1, padding: 14,
        shadowColor: "#000", shadowOpacity: 0.06, shadowRadius: 6, shadowOffset: { width: 0, height: 3 }, elevation: 2,
    },
    totalCard: {
        width: "100%", borderRadius: 14, padding: 14, borderWidth: 1, borderColor: "#eaeaea", backgroundColor: "#fafafa",
    },
    title: { fontSize: 13, fontWeight: "800", marginBottom: 6 },
    value: { fontSize: 18, fontWeight: "900", color: C.text },
});
