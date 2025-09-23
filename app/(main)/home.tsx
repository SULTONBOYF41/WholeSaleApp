// app/(main)/home.tsx
import { Button, C, H1, Muted } from "@/components/UI";
import { useAppStore } from "@/store/appStore";
import { router } from "expo-router";
import React, { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";

export default function Home() {
    const setMenu = useAppStore((s) => s.setMenu);

    const scale = useRef(new Animated.Value(0.98)).current;
    useEffect(() => {
        setMenu(false); // endi menyuni avtomatik ochmaymiz
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
                <H1>Асосий меню</H1>
                <Muted style={{ textAlign: "center", marginTop: 6 }}>
                    Kerakli bo‘limni tanlang. Har bir bo‘limning tepasida do‘kon/filialni dropdown’dan tanlaysiz.
                </Muted>

                <View style={{ height: 14 }} />

                <Button title="Hisobot" onPress={() => router.push("/(main)/report")} />
                <View style={{ height: 8 }} />
                <Button title="Сотиш" onPress={() => router.push("/(main)/sales")} />
                <View style={{ height: 8 }} />
                <Button title="Қайтариш" onPress={() => router.push("/(main)/returns")} />
                <View style={{ height: 8 }} />
                <Button title="Monitoring" onPress={() => router.push("/(main)/monitoring")} tone="neutral" />
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
        alignItems: "stretch",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.12,
        shadowRadius: 12,
        elevation: 6,
    },
});
