import React, { useState } from "react";
import {
    FlatList,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export const C = {
    bg: "#F6F7FB",
    white: "#fff",
    border: "#E9ECF1",
    text: "#1F2937",
    muted: "#6B7280",
    primary: "#770E13",
    primarySoft: "#FCE9EA",
    dark: "#0F172A",
    success: "#059669",
};

export function Screen({ children, style }: { children: React.ReactNode; style?: any }) {
    return <View style={[{ flex: 1, backgroundColor: C.bg }, style]}>{children}</View>;
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
    return (
        <View
            style={[
                {
                    backgroundColor: C.white,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: C.border,
                    padding: 14,
                },
                style,
            ]}
        >
            {children}
        </View>
    );
}

// ✅ H1 endi style ni qabul qiladi
export function H1({ children, style }: { children: React.ReactNode; style?: any }) {
    return <Text style={[{ fontSize: 24, fontWeight: "800", color: C.text }, style]}>{children}</Text>;
}

export function H2({ children, style }: { children: React.ReactNode; style?: any }) {
    return <Text style={[{ fontSize: 16, fontWeight: "800", color: C.text }, style]}>{children}</Text>;
}

export function Muted({ children, style }: { children: React.ReactNode; style?: any }) {
    return <Text style={[{ color: C.muted }, style]}>{children}</Text>;
}

// ✅ Button endi textStyle ni ham qabul qiladi
export function Button({
    title,
    onPress,
    tone = "primary",
    disabled,
    style,
    textStyle,
}: {
    title: string;
    onPress: () => void;
    tone?: "primary" | "neutral" | "danger" | "success";
    disabled?: boolean;
    style?: any;
    textStyle?: any;
}) {
    const bg =
        tone === "primary" ? C.primary : tone === "success" ? C.success : tone === "danger" ? "#ef4444" : "#F5F6FA";
    const color = tone === "primary" || tone === "success" || tone === "danger" ? "#fff" : C.text;

    return (
        <TouchableOpacity
            onPress={onPress}
            disabled={disabled}
            style={[
                {
                    backgroundColor: bg,
                    paddingVertical: 14,
                    borderRadius: 14,
                    opacity: disabled ? 0.6 : 1,
                    alignItems: "center",
                },
                style,
            ]}
        >
            <Text style={[{ color, fontWeight: "800" }, textStyle]}>{title}</Text>
        </TouchableOpacity>
    );
}

export function Input(props: any) {
    return (
        <TextInput
            {...props}
            style={[
                {
                    borderWidth: 1,
                    borderColor: C.border,
                    borderRadius: 12,
                    padding: 12,
                    backgroundColor: C.white,
                },
                props.style,
            ]}
        />
    );
}

export function Chip({ active, label, style }: { active?: boolean; label: string; style?: any }) {
    return (
        <View
            style={[
                {
                    paddingVertical: 8,
                    paddingHorizontal: 14,
                    borderRadius: 16,
                    borderWidth: 1,
                    borderColor: active ? C.primary : C.border,
                    backgroundColor: active ? C.primarySoft : C.white,
                },
                style,
            ]}
        >
            <Text style={{ color: active ? C.primary : C.text, fontWeight: "700" }}>{label}</Text>
        </View>
    );
}

/** Oddiy Select – modal roʻyxat */
export function Select({
    value,
    onChange,
    options,
    placeholder = "Танланг",
    style,
    itemStyle,
}: {
    value?: string;
    onChange: (v: string) => void;
    options: { label: string; value: string }[];
    placeholder?: string;
    style?: any;
    itemStyle?: any;
}) {
    const [open, setOpen] = useState(false);
    const current = options.find((o) => o.value === value)?.label ?? placeholder;
    return (
        <>
            <Pressable
                onPress={() => setOpen(true)}
                style={[
                    {
                        borderWidth: 1,
                        borderColor: C.border,
                        borderRadius: 12,
                        padding: 12,
                        backgroundColor: C.white,
                    },
                    style,
                ]}
            >
                <Text style={{ color: value ? C.text : C.muted }}>{current}</Text>
            </Pressable>
            <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
                <Pressable style={styles.backdrop} onPress={() => setOpen(false)} />
                <View style={styles.sheet}>
                    <FlatList
                        data={options}
                        keyExtractor={(i) => i.value}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                onPress={() => {
                                    onChange(item.value);
                                    setOpen(false);
                                }}
                                style={[{ padding: 14, borderBottomWidth: 1, borderColor: C.border }, itemStyle]}
                            >
                                <Text style={{ fontSize: 16 }}>{item.label}</Text>
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.2)" },
    sheet: {
        position: "absolute",
        left: 16,
        right: 16,
        top: Platform.select({ ios: 100, android: 80 }),
        backgroundColor: C.white,
        borderRadius: 16,
        overflow: "hidden",
        borderWidth: 1,
        borderColor: C.border,
    },
});
