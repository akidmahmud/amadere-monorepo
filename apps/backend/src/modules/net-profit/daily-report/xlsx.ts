import ExcelJS from 'exceljs';
import type { Cell, Worksheet } from 'exceljs';
import { fixedCostLabel } from '@amader/shared';
import type { DailyReportSnapshot, DailyReportTotals } from '@amader/shared';

// The owner's sheet layout in the admin's green (same dark header as the
// Sales Report export, sheetStyle.ts SHEET_COLORS).
const FILL = {
  title: 'FFE2EFDA',
  head: 'FF1F5C3F',
  grand: 'FFC6E0B4',
  total: 'FFE2EFDA',
  srcA: 'FFC6E0B4',
  srcB: 'FFE2EFDA',
};
const HEAD = [
  'source',
  'product name',
  'Sum of Qty (kg)',
  'Total sales value',
  'avg value',
  'Product cost/kg',
  'Total Product Cost',
  'Delivery Cost',
  'Profit by Product',
  'Fixed costs',
  'Net Profit',
];
const MONEY = '#,##0.00;[Red]-#,##0.00';

const fill = (c: Cell, argb: string) => {
  c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb } };
};

/** One cost row: name in B, value in J (Fixed costs). */
const costRow = (ws: Worksheet, name: string, value: number) =>
  ws.addRow(['', name, null, null, null, null, null, null, null, value, null]);

function totalRow(
  ws: Worksheet,
  label: string,
  t: DailyReportTotals,
  fixed: number | null,
  net: number | null,
  bold: boolean,
) {
  const r = ws.addRow([
    label,
    '',
    t.qty,
    t.sales,
    t.avg,
    null,
    t.cost,
    t.delivery,
    t.profit,
    fixed,
    net,
  ]);
  r.eachCell({ includeEmpty: true }, (c) =>
    fill(c, bold ? FILL.grand : FILL.total),
  );
  r.font = { bold: true, size: bold ? 12 : 11 };
}

export function buildDailyReportWorkbook(
  s: DailyReportSnapshot,
  title: string,
): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet('Daily Report', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });
  ws.columns = HEAD.map((_, i) => ({ width: i === 1 ? 30 : 16 }));

  const t = ws.addRow([title]);
  ws.mergeCells(1, 1, 1, HEAD.length);
  t.height = 30;
  t.getCell(1).font = { bold: true, size: 14 };
  t.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  fill(t.getCell(1), FILL.title);

  const h = ws.addRow(HEAD);
  h.height = 32;
  h.eachCell((c) => {
    c.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    c.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    fill(c, FILL.head);
  });

  s.sources.forEach((b, bi) => {
    const srcFill = bi % 2 ? FILL.srcB : FILL.srcA;
    if (!b.products.length) fill(ws.addRow([b.label]).getCell(1), srcFill);
    b.products.forEach((p, i) => {
      const r = ws.addRow([
        i === 0 ? b.label : '',
        p.estimated ? `${p.name} (est.)` : p.name,
        p.qty,
        p.sales,
        p.avg,
        p.costPerKg,
        p.cost,
        null,
        p.profit,
        null,
        null,
      ]);
      if (i === 0) fill(r.getCell(1), srcFill);
    });
    const fixed = b.fixedCosts.reduce((a, f) => a + f.value, 0);
    totalRow(ws, 'total', b.subtotal, fixed || null, b.net, false);
    for (const f of b.fixedCosts)
      costRow(ws, `Less: ${fixedCostLabel(f)}`, f.value);
    ws.addRow([]);
  });

  // Fixed costs / Net here are the sources' own; the whole-report costs
  // below come off this net to give NET PROFIT.
  const sourceFixed = s.sources.reduce(
    (a, b) => a + b.fixedCosts.reduce((x, f) => x + f.value, 0),
    0,
  );
  const sourceNet = s.sources.reduce((a, b) => a + b.net, 0);
  totalRow(
    ws,
    'GRAND TOTAL',
    s.grandTotal,
    Math.round(sourceFixed * 100) / 100 || null,
    Math.round(sourceNet * 100) / 100,
    true,
  );
  for (const f of s.reportFixedCosts)
    costRow(ws, `Less: ${fixedCostLabel(f)}`, f.value);
  const n = ws.addRow([
    'NET PROFIT',
    '',
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    null,
    s.netProfit,
  ]);
  n.font = { bold: true, size: 12 };
  n.getCell(11).font = {
    bold: true,
    size: 12,
    color: { argb: s.netProfit < 0 ? 'FFFF0000' : 'FF000000' },
  };

  ws.eachRow((row, rn) => {
    if (rn <= 2) return;
    row.eachCell((c, cn) => {
      if (typeof c.value === 'number') c.numFmt = cn === 3 ? '0.###' : MONEY;
    });
  });
  return wb;
}
