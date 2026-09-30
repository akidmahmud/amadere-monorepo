import type { Row, Worksheet } from 'exceljs';
import { buildSnapshot } from './build';
import { FIXTURE_INPUT } from './fixture';
import { buildDailyReportWorkbook } from './xlsx';

const find = (ws: Worksheet, first: string): Row => {
  let hit: Row | undefined;
  ws.eachRow((r) => {
    if (!hit && r.getCell(1).value === first) hit = r;
  });
  if (!hit) throw new Error(`no row starting with ${first}`);
  return hit;
};

describe('buildDailyReportWorkbook', () => {
  const wb = buildDailyReportWorkbook(
    buildSnapshot(FIXTURE_INPUT),
    'Amader eBuy Limited - Sep 30, 2026 - Daily Report',
  );
  const ws = wb.getWorksheet('Daily Report')!;

  it('has the title and the sheet column headers', () => {
    expect(ws.getCell('A1').value).toBe(
      'Amader eBuy Limited - Sep 30, 2026 - Daily Report',
    );
    expect(ws.getRow(2).getCell(3).value).toBe('Sum of Qty (kg)');
    expect(ws.getRow(2).getCell(11).value).toBe('Net Profit');
  });

  it('labels the first product row of each source and marks estimates', () => {
    expect(find(ws, 'Website').getCell(2).value).toBe('Jober Atta');
    const names: unknown[] = [];
    ws.eachRow((r) => names.push(r.getCell(2).value));
    expect(names).toContain('Pink Salt (est.)');
  });

  it('writes the grand total and a red negative net profit', () => {
    expect(find(ws, 'GRAND TOTAL').getCell(4).value).toBe(3610);
    const net = find(ws, 'NET PROFIT').getCell(11);
    expect(net.value).toBe(-1130.5);
    expect(net.font?.color?.argb).toBe('FFFF0000');
  });

  it('uses the admin green: dark header with white text, green totals', () => {
    const argb = (c: { fill?: unknown }) =>
      (c.fill as { fgColor?: { argb?: string } } | undefined)?.fgColor?.argb;
    const head = ws.getRow(2).getCell(1);
    expect(argb(head)).toBe('FF1F5C3F');
    expect(head.font?.color?.argb).toBe('FFFFFFFF');
    expect(argb(find(ws, 'GRAND TOTAL').getCell(1))).toBe('FFC6E0B4');
    expect(argb(find(ws, 'total').getCell(1))).toBe('FFE2EFDA');
  });

  it('serialises to a real xlsx buffer', async () => {
    const buf = await wb.xlsx.writeBuffer();
    expect(buf.byteLength).toBeGreaterThan(1000);
  });
});
