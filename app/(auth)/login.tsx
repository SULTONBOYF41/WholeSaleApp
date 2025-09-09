import { Button, C, H1, Input } from "@/components/UI";
import { signInLocal } from "@/lib/local-auth";
import { router } from "expo-router";
import { useState } from "react";
import { Alert, View } from "react-native";

export default function Login() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");

    const onLogin = async () => {
        const res = await signInLocal(email.trim(), password);
        if (res.ok) router.replace("/"); else Alert.alert("Хато", res.message);
    };

    return (
        <View style={{ flex: 1, justifyContent: "center", padding: 20, gap: 16, backgroundColor: C.bg }}>
            <H1>Кириш</H1>
            <Input placeholder="Логин" value={email} onChangeText={setEmail} autoCapitalize="none" />
            <Input placeholder="Парол" value={password} onChangeText={setPassword} secureTextEntry />
            <Button title="Кириш" onPress={onLogin} />
        </View>
    );
}
