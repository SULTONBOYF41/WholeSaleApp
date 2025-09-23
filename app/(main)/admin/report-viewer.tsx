// app/(main)/admin/report-viewer.tsx
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";

// Ixtiyoriy: agar sizda ranglar bor bo'lsa, ishlating; yo'q bo'lsa qat'iy qiymatlar qoldiriladi
const BORDER = "#E5E7EB";
const HEADER_BG = "#FFFFFF";
const BRAND = "#770E13";

export default function ReportViewer() {
    const router = useRouter();
    const { uri, title } = useLocalSearchParams<{ uri?: string; title?: string }>();

    // URL decode (dashboarddan kelganda encode bo‘lishi mumkin)
    const raw = typeof uri === "string" ? uri : "";
    const fileUri = raw ? decodeURIComponent(raw) : "";

    // HTTP/HTTPS bo‘lsa — embed qilish mumkin
    const isHttp = useMemo(() => /^https?:/i.test(fileUri), [fileUri]);

    // Google Viewer orqali yengil embed (http/https bo‘lsa)
    const viewerUrl = useMemo(
        () =>
            isHttp
                ? `https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(
                    fileUri
                )}`
                : null,
        [isHttp, fileUri]
    );

    const openExternally = () => {
        if (!fileUri) return;
        try {
            Linking.openURL(fileUri);
        } catch { }
    };

    return (
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
            {/* Header */}
            <View
                style={{
                    paddingTop: Platform.select({ ios: 52, android: 22 }),
                    paddingBottom: 12,
                    paddingHorizontal: 12,
                    borderBottomWidth: 1,
                    borderColor: BORDER,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                    backgroundColor: HEADER_BG,
                }}
            >
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderWidth: 1,
                        borderColor: BORDER,
                        borderRadius: 10,
                        backgroundColor: "#F5F6FA",
                    }}
                >
                    <Text style={{ fontWeight: "800" }}>Orqaga</Text>
                </TouchableOpacity>

                <Text
                    style={{ fontWeight: "900", fontSize: 16, flex: 1 }}
                    numberOfLines={1}
                >
                    {title || "Hisobot (PDF)"}
                </Text>

                {/* Har doim ochish tugmasi — local file bo'lsa ayniqsa kerak bo'ladi */}
                {!!fileUri && (
                    <TouchableOpacity onPress={openExternally}>
                        <Text style={{ color: BRAND, fontWeight: "800" }}>Open</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Body */}
            <View style={{ flex: 1 }}>
                {!fileUri ? (
                    <View
                        style={{ flex: 1, alignItems: "center", justifyContent: "center" }}
                    >
                        <Text>PDF topilmadi</Text>
                    </View>
                ) : isHttp && viewerUrl ? (
                    // HTTP/HTTPS: WebView + Google viewer
                    <WebView style={{ flex: 1 }} source={{ uri: viewerUrl }} />
                ) : (
                    // file:// yoki no-HTTP — Expo Go’da embed qilib bo‘lmaydi, tashqarida ochishga yo‘naltiramiz
                    <View style={{ flex: 1, padding: 16, gap: 12 }}>
                        <Text style={{ fontSize: 16 }}>
                            Bu faylni Expo Go ichida ko‘rsatib bo‘lmadi. "Open" tugmasi orqali
                            tashqi ilovada oching.
                        </Text>
                        <TouchableOpacity
                            onPress={openExternally}
                            style={{
                                backgroundColor: BRAND,
                                paddingVertical: 12,
                                borderRadius: 12,
                            }}
                        >
                            <Text
                                style={{
                                    color: "#fff",
                                    fontWeight: "800",
                                    textAlign: "center",
                                }}
                            >
                                Tashqi ilovada ochish
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}
