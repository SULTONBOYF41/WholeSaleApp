// components/NetBanner.tsx
import { getJSON, setJSON } from "@/lib/storage";
import { useSyncStore } from "@/store/syncStore";
import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";

const PRIMARY = "#770E13";
const CREAM = "#F6EAD4";
const SEEN_KEY = "net_popup_seen_v1";

export function NetStatusPill() {
    const online = useSyncStore((s) => s.online);
    return (
        <View
            style={{
                alignSelf: "flex-start",
                marginLeft: 12,
                marginTop: 8,
                paddingHorizontal: 10,
                paddingVertical: 4,
                borderRadius: 999,
                backgroundColor: online ? PRIMARY : "#999",
            }}
        >
            <Text style={{ color: CREAM, fontWeight: "700" }}>{online ? "Online" : "Offline"}</Text>
        </View>
    );
}

export function NetPopupOnce() {
    const [visible, setVisible] = useState(false);
    useEffect(() => {
        (async () => {
            const seen = await getJSON<{ at: number } | null>(SEEN_KEY, null);
            if (!seen) {
                setVisible(true);
                await setJSON(SEEN_KEY, { at: Date.now() });
            }
        })();
    }, []);

    return (
        <Modal visible={visible} transparent animationType="fade">
            <Pressable onPress={() => setVisible(false)} style={{ flex: 1, backgroundColor: "#0006", justifyContent: "center", alignItems: "center" }}>
                <View style={{ backgroundColor: "#fff", padding: 18, borderRadius: 16, width: "80%" }}>
                    <Text style={{ fontSize: 16, fontWeight: "800", marginBottom: 8 }}>Avto Sync</Text>
                    <Text style={{ lineHeight: 20 }}>
                        Offline rejimda ma’lumotlar mahalliy xotirada saqlanadi. Internet tiklanganda ular
                        avtomatik ravishda serverga yuboriladi (push) va yangilanadi (pull).
                    </Text>
                    <Pressable onPress={() => setVisible(false)} style={{ alignSelf: "flex-end", marginTop: 12 }}>
                        <Text style={{ color: PRIMARY, fontWeight: "700" }}>Tushunarli</Text>
                    </Pressable>
                </View>
            </Pressable>
        </Modal>
    );
}
