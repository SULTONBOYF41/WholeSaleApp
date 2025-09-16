// lib/pdf.ts
import * as FileSystemLegacy from "expo-file-system/legacy";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

/** Format helper */
const money = (n: number) => (n || 0).toLocaleString("ru-RU").replace(/\s/g, " ") + " so'm";

/* =========================
   A) STORE DASHBOARD PDF (o‘zgarmagan)
   ========================= */

type SalesRow = { name: string; qty: number; total: number };
type ReturnRow = { name: string; qty: number };

export async function exportDashboardPdf(opts: {
  storeName: string;
  periodLabel: string;
  cards: { totalSales: number; totalCash: number; debt: number; returnCount: number; totalExpenses?: number; netProfit?: number };
  salesRank: SalesRow[];
  returnRank: ReturnRow[];
}): Promise<{ uri: string; name: string }> {
  const { storeName, periodLabel, cards, salesRank, returnRank } = opts;

  const optionalCardsHtml = [
    cards.totalExpenses != null
      ? `<div class="card"><div class="title">Xarajat</div><div class="value">${money(cards.totalExpenses)}</div></div>`
      : "",
    cards.netProfit != null
      ? `<div class="card"><div class="title">Sof foyda</div><div class="value">${money(cards.netProfit)}</div></div>`
      : "",
  ].join("");

  const html = `
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      *{ box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial; }
      h1{ font-size:20px; margin:0 0 8px; }
      .muted{ color:#6b7280; font-size:12px; }
      .grid{ display:grid; grid-template-columns:1fr 1fr; gap:12px; margin:12px 0 16px; }
      .card{ border:1px solid #e5e7eb; border-radius:12px; padding:14px; }
      .title{ color:#6b7280; font-weight:800; margin:0 0 6px; }
      .value{ font-size:20px; font-weight:900; }
      table{ width:100%; border-collapse:collapse; margin-top:8px; }
      th, td{ border:1px solid #e5e7eb; padding:8px; font-size:12px; }
      th{ background:#f9fafb; text-align:left; }
      .right{ text-align:right; }
      .section{ margin-top:16px; }
    </style>
  </head>
  <body>
    <h1>Hisobot — ${storeName}</h1>
    <div class="muted">Davr: ${periodLabel}</div>

    <div class="grid">
      <div class="card"><div class="title">Umumiy summa</div><div class="value">${money(cards.totalSales)}</div></div>
      <div class="card"><div class="title">Olingan summa</div><div class="value">${money(cards.totalCash)}</div></div>
      <div class="card"><div class="title">Qarz</div><div class="value">${money(cards.debt)}</div></div>
      <div class="card"><div class="title">Vazvrat (miqdor)</div><div class="value">${cards.returnCount}</div></div>
      ${optionalCardsHtml}
    </div>

    <div class="section">
      <h1>Sotuv reytingi</h1>
      <table>
        <thead><tr><th>Mahsulot</th><th class="right">Miqdor</th><th class="right">Daromad</th></tr></thead>
        <tbody>
          ${salesRank
      .map((r) => `<tr><td>${r.name}</td><td class="right">${r.qty}</td><td class="right">${money(r.total)}</td></tr>`)
      .join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h1>Vazvrat reytingi</h1>
      <table>
        <thead><tr><th>Mahsulot</th><th class="right">Miqdor</th></tr></thead>
        <tbody>
          ${returnRank.map((r) => `<tr><td>${r.name}</td><td class="right">${r.qty}</td></tr>`).join("")}
        </tbody>
      </table>
    </div>
  </body>
  </html>`;

  const name = `Hisobot_${storeName || "Store"}_${periodLabel}.pdf`;
  const { uri } = await Print.printToFileAsync({ html });

  const dest = FileSystemLegacy.documentDirectory + name;
  try { await FileSystemLegacy.deleteAsync(dest, { idempotent: true }); } catch { }
  await FileSystemLegacy.copyAsync({ from: uri, to: dest });

  return { uri: dest, name };
}

/* ==============================
   B) OYLIK UMUMIY SUMMARY PDF
   ============================== */

export type MonthlySummaryRow = {
  storeName: string;
  totalSales: number;
  totalReturns: number;
  totalCash: number;
  debt: number;
};

export async function exportMonthlySummaryPdf(opts: {
  ym: string;
  rows: MonthlySummaryRow[];
  totals: { sales: number; returns: number; cash: number; debt: number; expenses: number; netProfit: number };
  source?: "archive" | "summary";
  fileName?: string;
}): Promise<{ uri: string; name: string }> {
  const { ym, rows, totals, source, fileName } = opts;

  const tableRows = rows
    .map(
      (r) => `
      <tr>
        <td>${r.storeName}</td>
        <td class="right">${money(r.totalSales)}</td>
        <td class="right">${money(r.totalReturns)}</td>
        <td class="right">${money(r.totalCash)}</td>
        <td class="right">${money(r.debt)}</td>
      </tr>`
    )
    .join("");

  const html = `
  <html>
  <head>
    <meta charset="utf-8" />
    <style>
      *{ box-sizing: border-box; font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial; }
      h1{ font-size:20px; margin:0 0 8px; }
      .muted{ color:#6b7280; font-size:12px; }
      table{ width:100%; border-collapse:collapse; margin-top:8px; }
      th, td{ border:1px solid #e5e7eb; padding:8px; font-size:12px; }
      th{ background:#f9fafb; text-align:left; }
      .right{ text-align:right; }
      .grid{ display:grid; grid-template-columns:repeat(6, 1fr); gap:12px; margin:12px 0 16px; }
      .card{ border:1px solid #e5e7eb; border-radius:12px; padding:12px; }
      .title{ color:#6b7280; font-weight:800; margin:0 0 6px; }
      .value{ font-size:18px; font-weight:900; }
      .sum{ font-weight:bold; background:#fef3c7; }
    </style>
  </head>
  <body>
    <h1>Oylik umumiy hisobot — ${ym}</h1>
    <div class="muted">Manba: ${source === "archive" ? "Arxiv" : "Monthly Summary"}</div>

    <div class="grid">
      <div class="card"><div class="title">Sotuv</div><div class="value">${money(totals.sales)}</div></div>
      <div class="card"><div class="title">Qaytarish</div><div class="value">${money(totals.returns)}</div></div>
      <div class="card"><div class="title">Tushum</div><div class="value">${money(totals.cash)}</div></div>
      <div class="card"><div class="title">Qarz</div><div class="value">${money(totals.debt)}</div></div>
      <div class="card"><div class="title">Xarajat</div><div class="value">${money(totals.expenses)}</div></div>
      <div class="card"><div class="title">Sof foyda</div><div class="value">${money(totals.netProfit)}</div></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Do‘kon</th>
          <th class="right">Sotuv</th>
          <th class="right">Qaytarish</th>
          <th class="right">Tushum</th>
          <th class="right">Qarz</th>
        </tr>
      </thead>
      <tbody>
        ${tableRows}
        <tr class="sum">
          <td>Jami</td>
          <td class="right">${money(totals.sales)}</td>
          <td class="right">${money(totals.returns)}</td>
          <td class="right">${money(totals.cash)}</td>
          <td class="right">${money(totals.debt)}</td>
        </tr>
      </tbody>
    </table>

    <div class="muted" style="margin-top:10px">
      Izoh: Sof foyda = (Jami Sotuv − Jami Qaytarish) − Umumiy Xarajat.
    </div>
  </body>
  </html>`;

  const name = fileName || `Umumiy_${ym}.pdf`;
  const { uri } = await Print.printToFileAsync({ html });

  const dest = FileSystemLegacy.documentDirectory + name;
  try { await FileSystemLegacy.deleteAsync(dest, { idempotent: true }); } catch { }
  await FileSystemLegacy.copyAsync({ from: uri, to: dest });

  return { uri: dest, name };
}

/** Ixtiyoriy helper: tashqi share */
export async function sharePdf(uri: string, dialogTitle?: string) {
  try { await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle }); } catch { }
}
