// app/(main)/expenses/report.tsx
import { ReportCards } from "@/components/expenses/ReportCards";
import { useExpensesStore } from "@/store/expensesStore";
import { useEffect } from "react";
import { RefreshControl, ScrollView } from "react-native";

export default function ReportScreen() {
    const { fetchAll, loading, totals } = useExpensesStore();
    useEffect(() => { fetchAll(); }, []);
    return (
        <ScrollView refreshControl={<RefreshControl refreshing={loading} onRefresh={fetchAll} />}>
            <ReportCards totals={totals} />
        </ScrollView>
    );
}
