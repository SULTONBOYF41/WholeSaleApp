// components/UI.tsx
import React, { isValidElement, useState } from "react";
import {
    FlatList,
    Modal,
    Platform,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TextStyle,
    TouchableOpacity,
    View,
    ViewStyle,
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

type VS = { style?: ViewStyle | ViewStyle[] };

export function Screen({ children, style }: { children: React.ReactNode; style?: any }) {
    return <View style={[{ flex: 1, backgroundColor: C.bg }, style]}>{children}</View>;
}

/** --- Helper: Card ichiga string/number kelsa auto-<Text> --- */
function wrapChildrenForView(children: React.ReactNode): React.ReactNode {
    if (children == null) return null;
    // Agar oddiy string/number bo'lsa — <Text> ga o'raymiz
    if (typeof children === "string" || typeof children === "number") {
        return <Text>{children}</Text>;
    }
    // Agar array bo'lsa — string/number elementlarni <Text> ga o'rab chiqamiz
    if (Array.isArray(children)) {
        return children.map((ch, idx) => {
            if (typeof ch === "string" || typeof ch === "number") {
                return <Text key={`t-${idx}`}>{ch}</Text>;
            }
            return isValidElement(ch) ? React.cloneElement(ch as any, { key: (ch as any)?.key ?? `c-${idx}` }) : ch;
        });
    }
    // Boshqa holat — o'z holicha
    return children;
}

export function Card({ children, style }: { children?: React.ReactNode; style?: any }) {
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
            {wrapChildrenForView(children)}
        </View>
    );
}

// H1/H2/Muted: children’ni to‘g‘ridan-to‘g‘ri <Text> ichida chiqaramiz
export function H1({ children, style }: { children?: React.ReactNode; style?: TextStyle | TextStyle[] }) {
    return <Text style={[{ fontSize: 24, fontWeight: "800", color: C.text }, style as any]}>{children}</Text>;
}
export function H2({ children, style }: { children?: React.ReactNode; style?: TextStyle | TextStyle[] }) {
    return <Text style={[{ fontSize: 16, fontWeight: "800", color: C.text }, style as any]}>{children}</Text>;
}
export function Muted({ children, style }: { children?: React.ReactNode; style?: TextStyle | TextStyle[] }) {
    return <Text style={[{ color: C.muted }, style as any]}>{children}</Text>;
}

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
    style?: ViewStyle | ViewStyle[];
    textStyle?: TextStyle | TextStyle[];
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

export function Chip({ active, label, style }: { active?: boolean; label: string; style?: ViewStyle | ViewStyle[] }) {
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
    style?: ViewStyle | ViewStyle[];
    itemStyle?: ViewStyle | ViewStyle[];
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
