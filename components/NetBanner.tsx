// components/NetBanner.tsx
import { useSyncStore } from "@/store/syncStore";
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";

export default function NetBanner() {
    const online = useSyncStore((s) => s.online);

    // ❗ Matn qaytarmaymiz — faqat null yoki <View/>
    if (online) return null;

    return (
        <View style={styles.wrap}>
            <Ionicons name="cloud-offline" size={14} color="#fff" style={{ marginRight: 6 }} />
            <Text style={styles.txt}>Оффлайн — маълумотлар локалда сақланмоқда</Text>
        </View>
    );
}

const styles = StyleSheet.create({
    wrap: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#C0392B",
        paddingHorizontal: 12,
        paddingVertical: 6,
    },
    txt: { color: "#fff", fontSize: 12, fontWeight: "700" },
});
