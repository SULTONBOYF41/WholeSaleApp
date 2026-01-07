
// app/(auth)/login.tsx
import { Button, C, H1, Input } from "@/components/UI";
import { api } from "@/lib/api";
import { router } from "expo-router";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function Login() {
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const cardY = useRef(new Animated.Value(24)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(cardY, {
        toValue: 0,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(cardOpacity, {
        toValue: 1,
        duration: 400,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const onLogin = async () => {
    const l = login.trim();
    if (!l || !password) {
      Alert.alert("Xato", "Login va parolni kiriting");
      return;
    }

    setLoading(true);
    try {
      const res = await api.auth.login(l, password);
      if (res?.ok && res?.token) {
        router.replace("/");
      } else {
        Alert.alert("Xato", "Login yoki parol noto‘g‘ri");
      }
    } catch (e: any) {
      Alert.alert("Xato", e?.message ?? "Server bilan aloqa yo‘q");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: C.bg }}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.wrap}>
        <H1 style={styles.brand}>Kirish</H1>

        <Animated.View
          style={[
            styles.card,
            {
              opacity: cardOpacity,
              transform: [{ translateY: cardY }],
            },
          ]}
        >
          <Input placeholder="Login" value={login} onChangeText={setLogin} />
          <View style={{ height: 10 }} />
          <Input
            placeholder="Parol"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <View style={{ height: 12 }} />
          <Button
            title={loading ? "Tekshirilmoqda..." : "Kirish"}
            onPress={onLogin}
            disabled={loading}
          />

          {loading && (
            <View style={styles.loading}>
              <ActivityIndicator size="large" />
              <Text style={{ marginTop: 8 }}>Tekshirilmoqda...</Text>
            </View>
          )}
        </Animated.View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "center", padding: 20 },
  brand: { textAlign: "center", marginBottom: 12 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#eee",
  },
  loading: {
    marginTop: 12,
    alignItems: "center",
  },
});

