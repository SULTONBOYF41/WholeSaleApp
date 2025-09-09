import { Button, C } from "@/components/UI";
import { useAppStore } from "@/store/appStore";
import { useEffect } from "react";
import { Text, View } from "react-native";

export default function Home() {
    const setMenu = useAppStore(s => s.setMenu);
    useEffect(() => { setMenu(true); }, []);
    return (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: 16, backgroundColor: C.bg }}>
            <Text style={{ fontSize: 18, fontWeight: "800", textAlign: "center", color: C.text, marginBottom: 12 }}>
                Илтимос, чап тепадаги менюни очиб филиал ёки дўкон танланг.
            </Text>
            <Button title="Менюни очиш" onPress={() => setMenu(true)} tone="neutral" />
        </View>
    );
}
