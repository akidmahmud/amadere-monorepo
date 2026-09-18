import { BadRequestException } from '@nestjs/common';
import { parseCsv } from '../../../common/csv.util';

// Header aliases, lower-cased. Adjust against a real statement file
// (see the plan's Task 11 external-dependency note).
const ID_HEADERS = [
  'consignment id',
  'consignment_id',
  'consignmentid',
  'cid',
  'tracking id',
  'tracking_code',
  'tracking code',
];
const TOTAL_HEADERS = [
  'total charge',
  'total_charge',
  'total charges',
  'charge',
];
const PART_HEADERS = [
  'delivery charge',
  'delivery_charge',
  'cod charge',
  'cod_charge',
  'return charge',
  'return_charge',
];

export function parseCourierBill(csv: string): {
  rows: { consignmentId: string; charge: number }[];
  skipped: number;
} {
  const [head, ...body] = parseCsv(csv.replace(/^\uFEFF/, ''));
  const cols = (head ?? []).map((h) => h.trim().toLowerCase());
  const idCol = cols.findIndex((c) => ID_HEADERS.includes(c));
  const totalCol = cols.findIndex((c) => TOTAL_HEADERS.includes(c));
  const partCols = cols
    .map((c, i) => (PART_HEADERS.includes(c) ? i : -1))
    .filter((i) => i >= 0);
  if (idCol < 0)
    throw new BadRequestException('No consignment ID column found');
  if (totalCol < 0 && partCols.length === 0)
    throw new BadRequestException('No charge column found');

  const rows: { consignmentId: string; charge: number }[] = [];
  let skipped = 0;
  for (const r of body) {
    const consignmentId = (r[idCol] ?? '').trim();
    const cells = totalCol >= 0 ? [r[totalCol]] : partCols.map((i) => r[i]);
    const nums = cells.map((v) =>
      Number(String(v ?? '').replace(/[৳,\s]/g, '')),
    );
    if (!consignmentId || nums.some((n) => !Number.isFinite(n))) {
      skipped++;
      continue;
    }
    rows.push({
      consignmentId,
      charge: Math.round(nums.reduce((a, b) => a + b, 0) * 100) / 100,
    });
  }
  return { rows, skipped };
}
