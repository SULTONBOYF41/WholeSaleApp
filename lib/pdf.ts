// lib/pdf.ts
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

type SalesRow = { name: string; qty: number; total: number };
type ReturnRow = { name: string; qty: number };

export async function exportDashboardPdf(opts: {
  storeName: string;
  periodLabel: string; // mas: "2025-03"
  cards: { totalSales: number; totalCash: number; debt: number; returnCount: number };
  salesRank: SalesRow[];
  returnRank: ReturnRow[];
}) {
  const { storeName, periodLabel, cards, salesRank, returnRank } = opts;

  const money = (n: number) =>
    (n || 0).toLocaleString("ru-RU").replace(/\s/g, " ") + " so'm";

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
    </div>

    <div class="section">
      <h1>Sotuv reytingi</h1>
      <table>
        <thead><tr><th>Mahsulot</th><th class="right">Miqdor</th><th class="right">Daromad</th></tr></thead>
        <tbody>
          ${salesRank
      .map(
        (r) =>
          `<tr><td>${r.name}</td><td class="right">${r.qty}</td><td class="right">${money(
            r.total
          )}</td></tr>`
      )
      .join("")}
        </tbody>
      </table>
    </div>

    <div class="section">
      <h1>Vazvrat reytingi</h1>
      <table>
        <thead><tr><th>Mahsulot</th><th class="right">Miqdor</th></tr></thead>
        <tbody>
          ${returnRank
      .map((r) => `<tr><td>${r.name}</td><td class="right">${r.qty}</td></tr>`)
      .join("")}
        </tbody>
      </table>
    </div>
  </body>
  </html>`;

  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: "application/pdf" });
}
