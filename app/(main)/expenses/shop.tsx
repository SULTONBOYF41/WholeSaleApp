// app/(main)/expenses/shop.tsx
import ExpenseComposer from "@/components/expenses/ExpenseComposer";
import { useExpensesStore } from "@/store/expensesStore";
import React, { useEffect } from "react";

export default function ShopScreen() {
    const { fetchAll } = useExpensesStore();
    useEffect(() => { fetchAll(); }, []);
    return <ExpenseComposer kind="shop" />;
}
