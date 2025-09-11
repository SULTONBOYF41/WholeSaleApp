// components/expenses/ReportCards.tsx
import { StyleSheet, Text, View } from "react-native";

export function ReportCards({ totals }: { totals: { family: number; shop: number; bank: number; all: number } }) {
    const CARDS = [
        { label: "Oilaviy", value: totals.family },
        { label: "Do'kon", value: totals.shop },
        { label: "Bank", value: totals.bank },
        { label: "Jami", value: totals.all },
    ];
    return (
        <View style={styles.wrap}>
            {CARDS.map((c) => (
                <View key={c.label} style={styles.card}>
                    <Text style={styles.title}>{c.label}</Text>
                    <Text style={styles.value}>{c.value.toLocaleString()}</Text>
                </View>
            ))}
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: { padding: 12, gap: 12 },
    card: { backgroundColor: "#fff", borderWidth: 1, borderColor: "#eee", borderRadius: 12, padding: 14 },
    title: { fontSize: 13, color: "#770E13", fontWeight: "800", marginBottom: 6 },
    value: { fontSize: 20, fontWeight: "800", color: "#222" },
});
