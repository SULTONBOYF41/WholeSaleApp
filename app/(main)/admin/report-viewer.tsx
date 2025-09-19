// app/(main)/admin/report-viewer.tsx
import { C } from "@/components/UI";
import { useLocalSearchParams, useRouter } from "expo-router";
import React from "react";
import { Platform, Text, TouchableOpacity, View } from "react-native";
import Pdf from "react-native-pdf";

export default function ReportViewer() {
    const router = useRouter();
    const { uri, title } = useLocalSearchParams<{ uri?: string; title?: string }>();
    const fileUri = uri ? decodeURIComponent(String(uri)) : "";

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
                <TouchableOpacity
                    onPress={() => router.back()}
                    style={{
                        paddingHorizontal: 12,
                        paddingVertical: 8,
                        borderWidth: 1,
                        borderColor: C.border,
                        borderRadius: 10,
                        backgroundColor: "#F5F6FA",
                    }}
                >
                    <Text style={{ fontWeight: "800" }}>Orqaga</Text>
                </TouchableOpacity>

                <Text style={{ fontWeight: "900", fontSize: 16, flex: 1 }} numberOfLines={1}>
                    {title || "Hisobot"}
                </Text>
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
