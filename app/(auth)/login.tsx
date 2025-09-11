// app/(auth)/login.tsx
import { Button, C, H1, Input } from "@/components/UI";
import { signInLocal } from "@/lib/local-auth";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Animated, Easing, KeyboardAvoidingView, Platform, StyleSheet, Text, View } from "react-native";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    // Animatsiyalar
    const cardY = useRef(new Animated.Value(24)).current;
    const cardOpacity = useRef(new Animated.Value(0)).current;
    const pulse = useRef(new Animated.Value(0)).current; // soyaga/biroz scale ga

    useEffect(() => {
        // sahifa ochilganda karta pastdan “kirib keladi”
        Animated.parallel([
            Animated.timing(cardY, { toValue: 0, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
            Animated.timing(cardOpacity, { toValue: 1, duration: 420, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
        ]).start();

        // yengil “breathing” effekt (shadow/scale)
        Animated.loop(
            Animated.sequence([
                Animated.timing(pulse, { toValue: 1, duration: 1400, useNativeDriver: true }),
                Animated.timing(pulse, { toValue: 0, duration: 1400, useNativeDriver: true }),
            ])
        ).start();
    }, []);

    const scale = pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.01] });

    const onLogin = async () => {
        if (!email.trim() || !password) {
            Alert.alert("Маълумот етишмайди", "Логин ва паролни киритинг");
            return;
        }
        setLoading(true);
        try {
            const res = await signInLocal(email.trim(), password);
            if (res?.ok) router.replace("/"); else Alert.alert("Хато", res?.message ?? "Кириш муваффақиятсиз");
        } catch (e) {
            Alert.alert("Хато", "Кутилагандан ташқари хато рўй берди");
        } finally {
            setLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: C.bg }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
            <View style={styles.wrap}>
                <H1 style={styles.brand}>Кириш</H1>

                <Animated.View
                    style={[
                        styles.card,
                        {
                            opacity: cardOpacity,
                            transform: [{ translateY: cardY }, { scale }],
                        },
                    ]}
                >
                    <Input placeholder="Логин" value={email} onChangeText={setEmail} autoCapitalize="none" />
                    <View style={{ height: 10 }} />
                    <Input placeholder="Парол" value={password} onChangeText={setPassword} secureTextEntry />

                    <View style={{ height: 12 }} />
                    <Button title={loading ? "Кирилмоқда..." : "Кириш"} onPress={onLogin} disabled={loading} />

                    {loading && (
                        <View style={styles.loadingOverlay} pointerEvents="none">
                            <View style={styles.loadingCard}>
                                <ActivityIndicator size="large" />
                                <Text style={styles.loadingText}>Текширилмоқда...</Text>
                            </View>
                        </View>
                    )}
                </Animated.View>
            </View>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    wrap: { flex: 1, alignItems: "center", justifyContent: "center", padding: 20 },
    brand: { textAlign: "center", marginBottom: 10 },
    card: {
        width: "100%",
        maxWidth: 460,
        backgroundColor: "#fff",
        borderRadius: 16,
        padding: 16,
        borderWidth: 1,
        borderColor: "#eee",
        // soyalar
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.15,
        shadowRadius: 16,
        elevation: 8,
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(255,255,255,0.6)",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 16,
    },
    loadingCard: {
        backgroundColor: "#fff",
        paddingVertical: 14,
        paddingHorizontal: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: "#eee",
        alignItems: "center",
    },
    loadingText: { marginTop: 8, fontWeight: "700" },
});
