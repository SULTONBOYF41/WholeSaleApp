// app/(main)/expenses/family.tsx
import ExpenseComposer from "@/components/expenses/ExpenseComposer";
import { useExpensesStore } from "@/store/expensesStore";
import React, { useEffect } from "react";

export default function FamilyScreen() {
    const { fetchAll } = useExpensesStore();
    useEffect(() => { fetchAll(); }, []);
    return <ExpenseComposer kind="family" />;
}
