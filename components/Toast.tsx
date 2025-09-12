import { useToastStore } from "@/store/toastStore";
import React, { useEffect, useRef } from "react";
import { ActivityIndicator, Animated, StyleSheet, Text, View } from "react-native";

const BRAND = "#770E13";

export default function Toast() {
    const visible = useToastStore((s) => s.visible);
    const text = useToastStore((s) => s.text);
    const mode = useToastStore((s) => s.mode);

    const opacity = useRef(new Animated.Value(0)).current;
    const scale = useRef(new Animated.Value(0.98)).current;

    useEffect(() => {
        if (visible) {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 1, duration: 160, useNativeDriver: true }),
                Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 18, bounciness: 6 }),
            ]).start();
        } else {
            Animated.parallel([
                Animated.timing(opacity, { toValue: 0, duration: 160, useNativeDriver: true }),
                Animated.timing(scale, { toValue: 0.98, duration: 160, useNativeDriver: true }),
            ]).start();
        }
    }, [visible]);

    if (!visible) return null;

    const isLoading = mode === "loading";

    return (
        <View style={StyleSheet.absoluteFill} pointerEvents="auto">
            {/* Dim background */}
            <Animated.View style={[styles.dim, { opacity }]} />

            {/* Center card */}
            <View style={styles.centerWrap} pointerEvents="none">
                <Animated.View style={[styles.card, { opacity, transform: [{ scale }] }]}>
                    {isLoading && <ActivityIndicator size="small" />}
                    <Text style={[styles.text, isLoading && { marginTop: 8 }]}>{text}</Text>
                </Animated.View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    dim: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: "rgba(0,0,0,0.15)",
    },
    centerWrap: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    card: {
        minWidth: 220,
        maxWidth: "80%",
        backgroundColor: "white",
        paddingVertical: 16,
        paddingHorizontal: 18,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: "#E9ECF1",
        alignItems: "center",
        shadowColor: "#000",
        shadowOpacity: 0.12,
        shadowRadius: 18,
        shadowOffset: { width: 0, height: 10 },
        elevation: 6,
    },
    text: {
        color: BRAND,
        fontWeight: "800",
        textAlign: "center",
    },
});
