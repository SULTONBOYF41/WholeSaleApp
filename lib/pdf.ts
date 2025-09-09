// lib/pdf.ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { Platform } from "react-native";

export async function exportDashboardPDF(args: {
    storeName: string;
    ym: string; // YYYY-MM
    totalSales: number;
    totalCash: number;
    debt: number;
    totalReturnsQty: number;
}) {
    const { storeName, ym, totalSales, totalCash, debt, totalReturnsQty } = args;
    const fmt = (n: number) => `${Math.round(n).toLocaleString()} so‘m`;

    const html = `
  <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { font-family: -apple-system, Roboto, Arial, sans-serif; padding: 24px; }
        h1 { font-size: 22px; margin: 0 0 10px; }
        .sub { color:#666; margin-bottom:16px; }
        .card { border:1px solid #eee; border-radius:12px; padding:12px; margin-bottom:10px; }
        .row { display:flex; gap:10px; }
        .col { flex:1; }
        .k { color:#555; font-size:12px; text-transform:uppercase; letter-spacing:.5px; }
        .v { font-size:18px; font-weight:700; margin-top:2px; }
      </style>
    </head>
    <body>
      <h1>Hisobot — ${escapeHtml(storeName)} — ${ym}</h1>
      <div class="sub">Oy: ${ym}</div>
      <div class="row">
        <div class="card col"><div class="k">Умумий сумма</div><div class="v">${fmt(totalSales)}</div></div>
        <div class="card col"><div class="k">Олинган сумма</div><div class="v">${fmt(totalCash)}</div></div>
      </div>
      <div class="row">
        <div class="card col"><div class="k">Қарз</div><div class="v">${fmt(debt)}</div></div>
        <div class="card col"><div class="k">Возврат (миқдор)</div><div class="v">${totalReturnsQty}</div></div>
      </div>
    </body>
  </html>`.trim();

    const { uri } = await Print.printToFileAsync({ html });
    const fileName = `hisobot_${storeName.replace(/\s+/g, "_")}_${ym}.pdf`;

    await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: fileName,
        UTI: Platform.OS === "ios" ? "com.adobe.pdf" : undefined,
    });
}

function escapeHtml(s: string) {
    return s.replace(/[&<>"']/g, (m) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]!));
}
