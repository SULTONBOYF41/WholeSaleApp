// app/(main)/admin/report-viewer.tsx
import * as FileSystem from "expo-file-system";
import * as IntentLauncher from "expo-intent-launcher";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useMemo } from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import { WebView } from "react-native-webview";

const BORDER = "#E5E7EB";
const HEADER_BG = "#FFFFFF";
const BRAND = "#770E13";

export default function ReportViewer() {
    const router = useRouter();
    const { uri, title } = useLocalSearchParams<{ uri?: string; title?: string }>();

    // URL decode
    const raw = typeof uri === "string" ? uri : "";
    const fileUri = raw ? decodeURIComponent(raw) : "";

    const isHttp = useMemo(() => /^https?:/i.test(fileUri), [fileUri]);
    const isFile = useMemo(() => /^file:/i.test(fileUri), [fileUri]);

    const viewerUrl = useMemo(
        () =>
            isHttp
                ? `https://drive.google.com/viewerng/viewer?embedded=true&url=${encodeURIComponent(fileUri)}`
                : null,
        [isHttp, fileUri]
    );

    // Android WebView lokal PDF-ni render qilmaydi, iOS esa file:// ni ko‘rsatadi
    const canInline = useMemo(() => {
        if (!fileUri) return false;
        if (isHttp) return true;                     // Google Viewer
        if (isFile && Platform.OS === "ios") return true; // iOS file:// inline
        return false;
    }, [fileUri, isHttp, isFile]);

    const openExternally = async () => {
        if (!fileUri) return;

        try {
            if (Platform.OS === "android" && isFile) {
                // 1) file:// -> content://
                const contentUri = await FileSystem.getContentUriAsync(fileUri);
                // 2) Intent ACTION_VIEW bilan ochish (pdf type) + read permission
                await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
                    data: contentUri,
                    type: "application/pdf",
                    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
                });
                return;
            }

            // iOS yoki http(s) — Linking yetarli
            await Linking.openURL(fileUri);
        } catch (e) {
            // fallback: share ochib beramiz
            try {
                await Linking.openURL(fileUri);
            } catch { }
        }
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

                <Text style={{ fontWeight: "900", fontSize: 16, flex: 1 }} numberOfLines={1}>
                    {title || "Hisobot (PDF)"}
                </Text>

                {!!fileUri && (
                    <TouchableOpacity onPress={openExternally}>
                        <Text style={{ color: BRAND, fontWeight: "800" }}>Open</Text>
                    </TouchableOpacity>
                )}
            </View>

            {/* Body */}
            <View style={{ flex: 1 }}>
                {!fileUri ? (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Text>PDF topilmadi</Text>
                    </View>
                ) : canInline ? (
                    isHttp && viewerUrl ? (
                        <WebView style={{ flex: 1 }} source={{ uri: viewerUrl }} />
                    ) : (
                        // iOS: file:// ni inline ko‘rsatamiz
                        <WebView
                            style={{ flex: 1 }}
                            source={{ uri: fileUri }}
                            originWhitelist={["*"]}
                            allowingReadAccessToURL={fileUri}
                        />
                    )
                ) : (
                    // Android file:// — ichida ko‘rsatmaymiz, Open orqali tashqarida ochiladi
                    <View style={{ flex: 1, padding: 16, gap: 12 }}>
                        <Text style={{ fontSize: 16 }}>
                            Bu faylni bu sahifada ko‘rsatib bo‘lmadi. {"Open"} tugmasi orqali tashqi ilovada oching.
                        </Text>
                        <TouchableOpacity
                            onPress={openExternally}
                            style={{ backgroundColor: BRAND, paddingVertical: 12, borderRadius: 12 }}
                        >
                            <Text style={{ color: "#fff", fontWeight: "800", textAlign: "center" }}>
                                Tashqi ilovada ochish
                            </Text>
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        </View>
    );
}
