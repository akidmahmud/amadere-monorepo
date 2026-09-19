import ExcelJS from 'exceljs';
import { addTitleRow, reportTitle } from './report-title';

describe('reportTitle', () => {
  it('names the day, the range, or today (Dhaka) with none', () => {
    expect(reportTitle('Expenses', '2026-08-18', '2026-08-18')).toBe('Amader eBuy Limited - Aug 18, 2026 - Expenses');
    expect(reportTitle('Dues', '2026-08-01', '2026-08-18')).toBe(
      'Amader eBuy Limited - Aug 1, 2026 to Aug 18, 2026 - Dues',
    );
    expect(reportTitle('Ledger', undefined, undefined, new Date('2026-09-18T20:00:00Z'))).toBe(
      'Amader eBuy Limited - Sep 19, 2026 - Ledger',
    );
  });
});

describe('addTitleRow', () => {
  it('puts the title above the column titles without losing any data', async () => {
    const wb = new ExcelJS.Workbook();
    const sheet = wb.addWorksheet('S');
    sheet.columns = [
      { header: 'A', key: 'a' },
      { header: 'B', key: 'b' },
    ];
    sheet.addRow({ a: 1, b: 2 });
    addTitleRow(sheet, 'T');

    // Round-trip through a real file, as the user receives it.
    const back = new ExcelJS.Workbook();
    await back.xlsx.load(Buffer.from(await wb.xlsx.writeBuffer()) as never);
    const s = back.getWorksheet('S')!;
    expect(s.getRow(1).getCell(1).value).toBe('T');
    expect(s.getRow(2).values).toEqual([undefined, 'A', 'B']);
    expect(s.getRow(3).values).toEqual([undefined, 1, 2]);
  });
});
