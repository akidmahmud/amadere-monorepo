import ExcelJS from 'exceljs';
import { dedupeByPhone, fillEmptyCrm, ImportWarnings, importNote, parseImportRows, readSheet, staffLookup } from './customer-import';

async function xlsx(rows: unknown[][]): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.addWorksheet('Sheet1').addRows(rows);
  return Buffer.from(await wb.xlsx.writeBuffer());
}

const EMPTY_CUSTOMER = {
  email: null, dob: null, assignedAdminId: null, nextCallTarget: null,
  hasNewOrder: false, newOrderAt: null, priority: null, crmStatus: null, behaviour: null,
  customerFeedback: null, amaderFeedback: null, familyDetails: null, purchaseReason: null,
  facebookProfileUrl: null, isFavorite: false,
};

describe('customer spreadsheet import', () => {
  it('reads the Retail Customer workbook layout by header name', async () => {
    const buffer = await xlsx([
      ['fv', 'B-DAY', 'Name', 'location', 'number', 'Email', 'Order Count', 'Product', 'Assign to', 'Start Date', 'Last Order Date', 'Next Call Target Date', 'New Order', 'New order Date', 'Priority', 'Status', 'Customer Feedback '],
      [null, null, 'Jahid Syed Khan', 'Gulshan, Dhaka', '01993007321', null, 37, 'Jober Chatu x35', 'Mim Akter', new Date('2023-05-31'), new Date('2026-07-15'), null, 'Yes', '17/08/2026', 'High', 'Not Started', null],
      // Excel stored the phone as a NUMBER, dropping the leading zero.
      [null, null, 'Mahmud', null, 1911418174, null, null, null, null, null, null, null, null, null, null, 'Regular', null],
      [null, null, 'No Phone', null, 'n/a', null, null, null, null, null, null, null, null, null, null, null, null],
    ]);
    const [a, b, c] = parseImportRows(await readSheet(buffer));

    expect(a).toMatchObject({
      row: 2, phone: '8801993007321', firstName: 'Jahid', lastName: 'Syed Khan', address: 'Gulshan, Dhaka',
      orderCount: '37', assignTo: 'Mim Akter', hasNewOrder: true, priority: 'HIGH', crmStatus: 'NOT_STARTED',
    });
    expect(a.newOrderAt?.toISOString().slice(0, 10)).toBe('2026-08-17'); // day-first
    expect(a.startDate?.toISOString().slice(0, 10)).toBe('2023-05-31');
    expect(b.phone).toBe('8801911418174');
    expect(b.crmStatus).toBeUndefined();
    expect(b.unrecognized).toEqual({ status: 'Regular' });
    expect(c.phone).toBeNull();
  });

  it('reads our own Export CSV headers and the legacy header-less CSV', async () => {
    const exported = parseImportRows(await readSheet(Buffer.from('"Birth Date","Name","Number","Assign To","Status","Agent Feedback"\r\n"","Rina","+8801711000000","Shama","FOLLOW_UP","call later"\r\n')));
    expect(exported[0]).toMatchObject({ phone: '8801711000000', firstName: 'Rina', assignTo: 'Shama', crmStatus: 'FOLLOW_UP', amaderFeedback: 'call later' });

    const legacy = parseImportRows(await readSheet(Buffer.from('Karim Uddin,01811000000,karim@example.com\n')));
    expect(legacy[0]).toMatchObject({ row: 1, phone: '8801811000000', firstName: 'Karim', email: 'karim@example.com' });
  });

  it('rejects a sheet with headers but no phone column', async () => {
    await expect(readSheet(Buffer.from('Name,Address\nA,B\n')).then(parseImportRows)).rejects.toThrow('No phone column');
  });

  it('only fills fields that are empty on an existing customer', () => {
    const row = parseImportRowsFrom({ Name: 'New Name', Priority: 'Low', Status: 'Done', 'Amader Feedback': 'from sheet' });
    const existing = { ...EMPTY_CUSTOMER, priority: 'HIGH' as const, assignedAdminId: 3 };

    const patch = fillEmptyCrm(existing, row, 9);
    expect(patch).toEqual({ crmStatus: 'DONE', amaderFeedback: 'from sheet' });

    // Re-importing once those are set changes nothing.
    const after = { ...existing, crmStatus: 'DONE' as const, amaderFeedback: 'from sheet' };
    expect(fillEmptyCrm(after, row, 9)).toEqual({});
    expect(fillEmptyCrm(EMPTY_CUSTOMER, row, 9)).toMatchObject({ assignedAdminId: 9, priority: 'LOW' });
  });

  it('keeps the sheet history columns as a note', () => {
    const row = parseImportRowsFrom({ location: 'Mirpur-10', 'Order Count': '35', Product: 'Jober Chatu x33' });
    expect(importNote(row)).toBe('Imported from spreadsheet.\nAddress: Mirpur-10\nOrder count (from sheet): 35\nProducts: Jober Chatu x33');
    expect(importNote(parseImportRowsFrom({}))).toBeNull();
    expect(importNote(row, { includeAddress: false })).not.toContain('Mirpur');
  });

  it('dedupes phones, matches staff names, and reports caveats', () => {
    const rows = parseImportRows([
      { row: 1, cells: ['number', 'Assign to', 'Status'] },
      { row: 2, cells: ['01711000000', 'mim', 'Regular'] },
      { row: 3, cells: ['+8801711000000', 'Mim Akter', ''] },
      { row: 4, cells: ['abc', '', ''] },
      { row: 5, cells: ['01811000000', 'Sanwar', ''] },
      { row: 6, cells: ['01911000000', 'sanwar', ''] },
    ]);
    const { unique, skippedRows } = dedupeByPhone(rows);
    expect(unique.map((r) => r.row)).toEqual([2, 5, 6]);
    expect(skippedRows).toEqual([{ row: 3, reason: 'Same phone as row 2' }, { row: 4, reason: 'Invalid phone number "abc"' }]);

    const staffIdFor = staffLookup([{ id: 1, name: 'Mim Akter' }, { id: 2, name: 'Jami Khan' }, { id: 3, name: 'Jami Das' }]);
    expect(staffIdFor('MIM')).toBe(1);
    expect(staffIdFor('jami')).toBeUndefined(); // ambiguous first name
    expect(staffIdFor('Jami Das')).toBe(3);

    const warnings = new ImportWarnings();
    for (const r of unique) warnings.noteRow(r, staffIdFor(r.assignTo));
    expect(warnings.list()).toEqual([
      'Assign to "Sanwar" (2 rows): no staff account with that name, left unassigned.',
      'Unknown status "Regular" (1 rows): left blank.',
    ]);
  });
});

function parseImportRowsFrom(fields: Record<string, string>) {
  const headers = ['number', ...Object.keys(fields)];
  return parseImportRows([
    { row: 1, cells: headers },
    { row: 2, cells: ['01700000000', ...Object.values(fields)] },
  ])[0];
}
