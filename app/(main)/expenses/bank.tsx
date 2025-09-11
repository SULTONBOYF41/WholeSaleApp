// app/(main)/expenses/bank.tsx
import ExpenseComposer from "@/components/expenses/ExpenseComposer";
import { useExpensesStore } from "@/store/expensesStore";
import React, { useEffect } from "react";

export default function BankScreen() {
    const { fetchAll } = useExpensesStore();
    useEffect(() => { fetchAll(); }, []);
    return <ExpenseComposer kind="bank" />;
}
