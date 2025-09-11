// app/(main)/home.tsx
import { Button, C } from "@/components/UI";
import { useAppStore } from "@/store/appStore";
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";

export default function Home() {
    const setMenu = useAppStore((s) => s.setMenu);

    // Yengil “breathing” animatsiya
    const scale = useRef(new Animated.Value(0.98)).current;
    useEffect(() => {
        setMenu(true); // kirganda menyuni ochib qo'yamiz
        Animated.loop(
            Animated.sequence([
                Animated.timing(scale, { toValue: 1, duration: 900, easing: Easing.out(Easing.quad), useNativeDriver: true }),
                Animated.timing(scale, { toValue: 0.98, duration: 900, easing: Easing.in(Easing.quad), useNativeDriver: true }),
            ])
        ).start();
    }, []);

    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: C.bg }}>
            <Animated.View style={[styles.card, { transform: [{ scale }] }]}>
                <Ionicons name="menu-outline" size={32} color="#770E13" />
                <Text style={styles.title}>Менюдан филиал ёки дўконни танланг</Text>
                <Text style={styles.subtitle}>Chap yuqoridagi tugmani bosing yoki pastdagi tugmadan foydalaning.</Text>
                <View style={{ height: 8 }} />
                <Button title="Менюни очиш" onPress={() => setMenu(true)} tone="neutral" />
            </Animated.View>
        </View>
    );
}

const styles = StyleSheet.create({
    card: {
        width: "100%",
        maxWidth: 520,
        backgroundColor: "#fff",
        borderWidth: 1,
        borderColor: "#eee",
        borderRadius: 16,
        padding: 18,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
    },
    title: { fontSize: 18, fontWeight: "800", textAlign: "center", color: C.text, marginTop: 8 },
    subtitle: { fontSize: 13, textAlign: "center", color: "#6b7280", marginTop: 6 },
});
