import type { Worksheet } from 'exceljs';

// Server-side twin of apps/admin/src/lib/reportTitle.ts for the exports built
// here with exceljs (Accounts). Same wording, so every downloaded report opens
// with the same line whichever side produced it.

const fmtDay = (day: string) =>
  new Date(`${day}T00:00:00Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  });

/** "Amader eBuy Limited - Aug 18, 2026 - Expenses"; dated today (Dhaka) with no range. */
export function reportTitle(name: string, from?: string, to?: string, today = new Date()): string {
  const start = (from || to)?.slice(0, 10);
  const end = (to || from)?.slice(0, 10);
  const when =
    !start || !end
      ? fmtDay(new Date(today.getTime() + 6 * 3600_000).toISOString().slice(0, 10))
      : start === end
        ? fmtDay(start)
        : `${fmtDay(start)} to ${fmtDay(end)}`;
  return `Amader eBuy Limited - ${when} - ${name}`;
}

/**
 * Pushes the sheet down one row and puts `title` above it: merged across the
 * used columns, bold, centred, on the same pale green as the admin's exports.
 * Also freezes the title + column-title rows.
 */
export function addTitleRow(sheet: Worksheet, title: string): void {
  const width = Math.max(1, sheet.columnCount);
  sheet.spliceRows(1, 0, [title]);
  sheet.mergeCells(1, 1, 1, width);
  const row = sheet.getRow(1);
  row.height = 30;
  const cell = row.getCell(1);
  cell.font = { bold: true, size: 14 };
  cell.alignment = { horizontal: 'center', vertical: 'middle' };
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2EFDA' } };
  sheet.getRow(2).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 2 }];
}
