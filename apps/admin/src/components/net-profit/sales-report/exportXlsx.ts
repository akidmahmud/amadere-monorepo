import { cellStyle, SHEET_COLORS, type SheetLayout } from "./sheetStyle";

export type SheetRows = (string | number | null | undefined)[][];

/**
 * Downloads `rows` as a real Excel file with coloured headers (a CSV can't
 * hold colours). exceljs is loaded only when Export is clicked, so it never
 * weighs on the report page itself.
 */
export async function downloadXlsx(
  name: string,
  rows: SheetRows,
  layout: SheetLayout = { headerRows: 1 },
  /** Optional title row above everything, e.g. from reportTitle(). */
  title?: string,
) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Report", {
    views: [{ state: "frozen", ySplit: layout.headerRows + (title ? 1 : 0) }],
  });

  if (title) {
    // Same look as the owner's own sheets: one merged, centred, bold line on
    // pale green above the column titles.
    const width = Math.max(1, ...rows.map((r) => r.length));
    const t = ws.addRow([title]);
    ws.mergeCells(1, 1, 1, width);
    t.height = 30;
    const c = t.getCell(1);
    c.font = { bold: true, size: 14 };
    c.alignment = { horizontal: "center", vertical: "middle" };
    c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: SHEET_COLORS.title } };
  }

  rows.forEach((r, i) => {
    const row = ws.addRow(r.map((v) => v ?? ""));
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const s = cellStyle(i, colNumber - 1, layout);
      if (!s) return;
      if (s.fill)
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: s.fill },
        };
      cell.font = {
        bold: s.bold,
        italic: s.italic,
        color: s.color ? { argb: s.color } : undefined,
      };
      if (i < layout.headerRows)
        cell.alignment = { vertical: "middle", wrapText: true };
    });
  });

  // Width from the longest value in each column, within sensible bounds.
  const widest = new Map<number, number>();
  rows.forEach((r) =>
    r.forEach((v, c) =>
      widest.set(c, Math.max(widest.get(c) ?? 0, String(v ?? "").length)),
    ),
  );
  widest.forEach((len, c) => {
    ws.getColumn(c + 1).width = Math.min(40, Math.max(10, len + 2));
  });

  const buf = await wb.xlsx.writeBuffer();
  const url = URL.createObjectURL(
    new Blob([buf], {
      type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    }),
  );
  const a = document.createElement("a");
  a.href = url;
  a.download = `amadere-${name}.xlsx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
