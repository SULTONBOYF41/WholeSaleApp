import { C } from "@/components/UI";
import * as FileSystem from "expo-file-system";
import * as FileSystemLegacy from "expo-file-system/legacy";
import * as Linking from "expo-linking";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import React from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import Pdf from "react-native-pdf";

export default function ReportViewer() {
    const router = useRouter();
    const { uri, title } = useLocalSearchParams<{ uri?: string; title?: string }>();
    const fileUri = uri ? decodeURIComponent(String(uri)) : "";

    const onShare = async () => {
        if (!fileUri) return;
        try { await Sharing.shareAsync(fileUri, { mimeType: "application/pdf" }); } catch { }
    };

    const onOpenExternal = async () => {
        if (!fileUri) return;
        try { await Linking.openURL(fileUri); } catch { }
    };

    const hasSAF =
        Platform.OS === "android" &&
        // @ts-ignore
        !!FileSystem.StorageAccessFramework &&
        typeof (FileSystem as any).StorageAccessFramework.requestDirectoryPermissionsAsync === "function";

    const onDownload = async () => {
        if (!fileUri) return;
        try {
            if (hasSAF) {
                const saf = (FileSystem as any).StorageAccessFramework;
                const perm = await saf.requestDirectoryPermissionsAsync();
                if (!perm.granted) { alert("Ruxsat berilmadi."); return; }
                const name = (title || "Hisobot").toString().replace(/\.pdf$/i, "");
                const outUri = await saf.createFileAsync(perm.directoryUri, name, "application/pdf");
                const b64 = await FileSystemLegacy.readAsStringAsync(fileUri, { encoding: FileSystemLegacy.EncodingType.Base64 });
                // turli SDK typelarida ogohlantirish chiqmasligi uchun:
                await FileSystem.writeAsStringAsync(outUri, b64, { encoding: "base64" as any });
                alert("Fayl yuklab olindi.");
            } else {
                // iOS yoki SAF yo‘q — share sheet
                await Sharing.shareAsync(fileUri, { mimeType: "application/pdf", dialogTitle: title || "Hisobot" });
            }
        } catch (e) {
            console.warn("download error", e);
            alert("Yuklab olishda xatolik yuz berdi.");
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
                    borderColor: C.border,
                    flexDirection: "row",
                    alignItems: "center",
                    gap: 8,
                }}
            >
                <TouchableOpacity onPress={() => router.back()} style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border, borderRadius: 10, backgroundColor: "#F5F6FA" }}>
                    <Text style={{ fontWeight: "800" }}>Orqaga</Text>
                </TouchableOpacity>
                <Text style={{ fontWeight: "900", fontSize: 16, flex: 1 }} numberOfLines={1}>
                    {title || "Hisobot"}
                </Text>
                <TouchableOpacity onPress={onShare} style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border, borderRadius: 10 }}>
                    <Text style={{ fontWeight: "800" }}>Ulashish</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onDownload} style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border, borderRadius: 10 }}>
                    <Text style={{ fontWeight: "800" }}>Yuklab olish</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onOpenExternal} style={{ paddingHorizontal: 12, paddingVertical: 8, borderWidth: 1, borderColor: C.border, borderRadius: 10 }}>
                    <Text style={{ fontWeight: "800" }}>Tashqi</Text>
                </TouchableOpacity>
            </View>

            {/* PDF Viewer */}
            <View style={{ flex: 1 }}>
                {fileUri ? (
                    <Pdf
                        source={{ uri: fileUri }}
                        style={{ flex: 1, width: "100%", height: "100%" }}
                        onError={(e) => console.warn("PDF load error:", e)}
                        trustAllCerts={Platform.OS === "android"}
                    />
                ) : (
                    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
                        <Text>PDF topilmadi</Text>
                    </View>
                )}
            </View>
        </View>
    );
}
