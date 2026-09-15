import { BadRequestException } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { Readable } from 'stream';
import { CustomerBehaviour, CustomerCrmStatus, CustomerPriority } from '@amader/db';
import { toBdCompact } from '@amader/shared';

// Customer spreadsheet import — the parsing/mapping half, kept free of Prisma
// calls so it can be tested directly (customer-import.spec.ts). The
// read/write half lives in CustomersService.importCustomers.
//
// Columns are found by HEADER NAME, not position, so staff can upload the
// sales team's "Retail Customer" workbook exactly as they keep it, our own
// Export CSV, or any sheet that has at least a phone column — in any order,
// with extra columns ignored.

type Field =
  | 'favorite' | 'dob' | 'name' | 'address' | 'phone' | 'email' | 'orderCount' | 'products'
  | 'assignTo' | 'startDate' | 'lastOrderDate' | 'nextCallTarget' | 'newOrder' | 'newOrderDate'
  | 'priority' | 'status' | 'behaviour' | 'customerFeedback' | 'amaderFeedback'
  | 'familyDetails' | 'purchaseReason' | 'facebook';

// Keys are headers lower-cased with everything but letters removed, so
// "B-DAY", "Customer Feedback " and "Next Call Target Date" all match.
const HEADER_ALIASES: Record<string, Field> = {
  fv: 'favorite', favorite: 'favorite', favourite: 'favorite',
  bday: 'dob', birthday: 'dob', birthdate: 'dob', dob: 'dob', dateofbirth: 'dob',
  name: 'name', customername: 'name',
  location: 'address', address: 'address',
  number: 'phone', phone: 'phone', mobile: 'phone', phonenumber: 'phone', mobilenumber: 'phone',
  email: 'email',
  ordercount: 'orderCount',
  product: 'products', products: 'products', productdetails: 'products',
  assignto: 'assignTo', assignedto: 'assignTo',
  startdate: 'startDate',
  lastorderdate: 'lastOrderDate',
  nextcalltargetdate: 'nextCallTarget', nextcalltarget: 'nextCallTarget',
  neworder: 'newOrder',
  neworderdate: 'newOrderDate',
  priority: 'priority',
  status: 'status', crmstatus: 'status',
  behaviour: 'behaviour', behavior: 'behaviour',
  customerfeedback: 'customerFeedback',
  amaderfeedback: 'amaderFeedback', agentfeedback: 'amaderFeedback',
  customerfamilydetails: 'familyDetails', familydetails: 'familyDetails',
  purchasereason: 'purchaseReason',
  facebookprofilelink: 'facebook', facebookprofile: 'facebook', facebook: 'facebook',
};

// The original CSV importer's documented format had no required header row.
const LEGACY_POSITIONAL: Field[] = ['name', 'phone', 'email', 'dob'];

export interface SheetRow {
  row: number;
  cells: unknown[];
}

export interface ImportRow {
  row: number;
  rawPhone: string;
  phone: string | null;
  firstName?: string;
  lastName?: string;
  email?: string;
  dob?: Date;
  address?: string;
  orderCount?: string;
  products?: string;
  lastOrderDate?: Date;
  assignTo?: string;
  startDate?: Date;
  nextCallTarget?: Date;
  hasNewOrder?: boolean;
  newOrderAt?: Date;
  priority?: CustomerPriority;
  crmStatus?: CustomerCrmStatus;
  behaviour?: CustomerBehaviour;
  customerFeedback?: string;
  amaderFeedback?: string;
  familyDetails?: string;
  purchaseReason?: string;
  facebookProfileUrl?: string;
  isFavorite?: boolean;
  /** Cell values that were present but didn't match a known option, e.g. { status: "Regular" }. */
  unrecognized: Partial<Record<'priority' | 'status' | 'behaviour', string>>;
}

/** .xlsx (a zip, so it starts with "PK") or CSV text — first worksheet only. */
export async function readSheet(buffer: Buffer): Promise<SheetRow[]> {
  const wb = new ExcelJS.Workbook();
  try {
    if (buffer.subarray(0, 2).toString('latin1') === 'PK') {
      await wb.xlsx.load(buffer as unknown as ArrayBuffer);
    } else {
      await wb.csv.read(Readable.from(buffer.toString('utf-8').replace(/^﻿/, '')));
    }
  } catch {
    throw new BadRequestException('Could not read the file. Upload an .xlsx workbook or a .csv file.');
  }
  const ws = wb.worksheets[0];
  if (!ws) throw new BadRequestException('The file has no worksheet.');
  const rows: SheetRow[] = [];
  // eachRow skips never-touched rows; formatting-only rows (Excel often
  // reports 1,048,576 of them) are dropped by the emptiness check below.
  ws.eachRow({ includeEmpty: false }, (r, n) => {
    const cells = (r.values as unknown[]).slice(1);
    if (cells.some((c) => cellText(c) !== '')) rows.push({ row: n, cells });
  });
  return rows;
}

export function parseImportRows(sheet: SheetRow[]): ImportRow[] {
  if (sheet.length === 0) return [];
  const header = sheet[0].cells.map((c) => HEADER_ALIASES[cellText(c).toLowerCase().replace(/[^a-z]/g, '')]);
  const hasHeader = header.includes('phone');
  let columns: (Field | undefined)[];
  let body: SheetRow[];
  if (hasHeader) {
    columns = header;
    body = sheet.slice(1);
  } else if (sheet[0].cells.length >= 2 && header.every((h) => h === undefined)) {
    columns = LEGACY_POSITIONAL;
    body = sheet;
  } else {
    throw new BadRequestException('No phone column found. The first row must be a header with a "Number" or "Phone" column.');
  }

  return body.map(({ row, cells }) => {
    const get = (field: Field): unknown => {
      const i = columns.indexOf(field);
      return i === -1 ? undefined : cells[i];
    };
    const text = (field: Field) => cellText(get(field)) || undefined;
    const rawPhone = cellText(get('phone'));
    const [firstName, ...rest] = (text('name') ?? '').split(/\s+/).filter(Boolean);
    const email = text('email')?.toLowerCase();
    const unrecognized: ImportRow['unrecognized'] = {};
    const pick = <T extends string>(field: 'priority' | 'status' | 'behaviour', options: Record<string, T>): T | undefined => {
      const raw = text(field);
      if (!raw) return undefined;
      const value = toEnum(raw, options);
      if (!value) unrecognized[field] = raw;
      return value;
    };

    return {
      row,
      rawPhone,
      phone: normalizeImportPhone(rawPhone),
      firstName,
      lastName: rest.length ? rest.join(' ') : undefined,
      email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : undefined,
      dob: toDate(get('dob')),
      address: text('address'),
      orderCount: text('orderCount'),
      products: text('products'),
      lastOrderDate: toDate(get('lastOrderDate')),
      assignTo: text('assignTo'),
      startDate: toDate(get('startDate')),
      nextCallTarget: toDate(get('nextCallTarget')),
      hasNewOrder: isYes(text('newOrder')) || undefined,
      newOrderAt: toDate(get('newOrderDate')),
      priority: pick('priority', CustomerPriority),
      crmStatus: pick('status', CustomerCrmStatus),
      behaviour: pick('behaviour', CustomerBehaviour),
      customerFeedback: text('customerFeedback'),
      amaderFeedback: text('amaderFeedback'),
      familyDetails: text('familyDetails'),
      purchaseReason: text('purchaseReason'),
      facebookProfileUrl: text('facebook'),
      isFavorite: isYes(text('favorite')) || undefined,
      unrecognized,
    };
  });
}

/** The CRM columns Customer and wholesale Party share, as the import reads them. */
export interface CrmFields {
  email: string | null; dob: Date | null; assignedAdminId: number | null; nextCallTarget: Date | null;
  hasNewOrder: boolean; newOrderAt: Date | null; priority: CustomerPriority | null;
  crmStatus: CustomerCrmStatus | null; behaviour: CustomerBehaviour | null; customerFeedback: string | null;
  amaderFeedback: string | null; familyDetails: string | null; purchaseReason: string | null;
  facebookProfileUrl: string | null; isFavorite: boolean;
}

/**
 * CRM fields to write onto a record that already exists: ONLY ones that are
 * empty in the system. Anything already set — by the customer, staff, or a
 * previous import — is never overwritten, so uploading the same (or an older)
 * workbook again cannot undo work done in the admin, and a re-run changes
 * nothing. Name/address handling differs per record type and is the caller's.
 */
export function fillEmptyCrm(existing: CrmFields, row: ImportRow, assignedAdminId: number | undefined): Partial<CrmFields> {
  const patch: Record<string, unknown> = {};
  const fill = (key: keyof CrmFields, value: unknown) => {
    if (value !== undefined && (existing[key] === null || existing[key] === false)) patch[key] = value;
  };
  fill('email', row.email);
  fill('dob', row.dob);
  fill('assignedAdminId', assignedAdminId);
  fill('nextCallTarget', row.nextCallTarget);
  fill('hasNewOrder', row.hasNewOrder);
  fill('newOrderAt', row.newOrderAt);
  fill('priority', row.priority);
  fill('crmStatus', row.crmStatus);
  fill('behaviour', row.behaviour);
  fill('customerFeedback', row.customerFeedback);
  fill('amaderFeedback', row.amaderFeedback);
  fill('familyDetails', row.familyDetails);
  fill('purchaseReason', row.purchaseReason);
  fill('facebookProfileUrl', row.facebookProfileUrl);
  fill('isFavorite', row.isFavorite);
  return patch as Partial<CrmFields>;
}

/**
 * The sheet's history columns (order count, products, last order, and the
 * address when the record has no address column of its own) are kept as one
 * note. Only written for records an import CREATES, so re-imports never stack
 * duplicate notes. Real order history still comes only from real orders.
 */
export function importNote(row: ImportRow, { includeAddress = true } = {}): string | null {
  const parts = [
    includeAddress && row.address && `Address: ${row.address}`,
    row.orderCount && `Order count (from sheet): ${row.orderCount}`,
    row.lastOrderDate && `Last order date (from sheet): ${row.lastOrderDate.toISOString().slice(0, 10)}`,
    row.products && `Products: ${row.products}`,
  ].filter(Boolean);
  return parts.length ? `Imported from spreadsheet.\n${parts.join('\n')}` : null;
}

/** One row per phone: rows without a valid phone, or repeating an earlier
 *  row's phone, are skipped with the reason. */
export function dedupeByPhone(rows: ImportRow[]): { unique: ImportRow[]; skippedRows: { row: number; reason: string }[] } {
  const skippedRows: { row: number; reason: string }[] = [];
  const byPhone = new Map<string, ImportRow>();
  for (const r of rows) {
    if (!r.phone) skippedRows.push({ row: r.row, reason: r.rawPhone ? `Invalid phone number "${r.rawPhone}"` : 'No phone number' });
    else if (byPhone.has(r.phone)) skippedRows.push({ row: r.row, reason: `Same phone as row ${byPhone.get(r.phone)!.row}` });
    else byPhone.set(r.phone, r);
  }
  return { unique: [...byPhone.values()], skippedRows };
}

/**
 * "Assign to" holds a staff member's name: matched on the full name, or on
 * the first name alone when exactly one active staff member has it.
 */
export function staffLookup(staff: { id: number; name: string }[]): (name: string | undefined) => number | undefined {
  const byName = new Map<string, number>();
  const firstNames = staff.map((s) => s.name.split(' ')[0].toLowerCase());
  staff.forEach((s, i) => {
    byName.set(s.name.toLowerCase(), s.id);
    if (firstNames.filter((f) => f === firstNames[i]).length === 1) byName.set(firstNames[i], s.id);
  });
  return (name) => (name ? byName.get(name.trim().toLowerCase()) : undefined);
}

/** Collects the per-row caveats every import reports the same way. */
export class ImportWarnings {
  private readonly unknownStaff = new Map<string, number>();
  private readonly unknownValues = new Map<string, number>();
  private readonly extra: string[] = [];

  noteRow(row: ImportRow, staffId: number | undefined): void {
    // Grouped case-insensitively ("Tulin" and "tulin" are one missing account), shown as first seen.
    if (row.assignTo && staffId === undefined) {
      const seen = [...this.unknownStaff.keys()].find((k) => k.toLowerCase() === row.assignTo!.toLowerCase());
      bump(this.unknownStaff, seen ?? row.assignTo);
    }
    for (const [field, value] of Object.entries(row.unrecognized)) bump(this.unknownValues, `${field} "${value}"`);
  }

  add(message: string): void {
    this.extra.push(message);
  }

  list(): string[] {
    return [
      ...[...this.unknownStaff].map(([name, n]) => `Assign to "${name}" (${n} rows): no staff account with that name, left unassigned.`),
      ...[...this.unknownValues].map(([value, n]) => `Unknown ${value} (${n} rows): left blank.`),
      ...this.extra,
    ];
  }
}

function bump(m: Map<string, number>, key: string) {
  m.set(key, (m.get(key) ?? 0) + 1);
}

function cellText(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (v instanceof Date) return Number.isNaN(v.getTime()) ? '' : v.toISOString();
  if (typeof v === 'object') {
    const o = v as { text?: unknown; result?: unknown; richText?: { text: string }[]; error?: unknown };
    if (Array.isArray(o.richText)) return o.richText.map((t) => t.text).join('').trim();
    if (o.text !== undefined) return cellText(o.text);
    if (o.result !== undefined) return cellText(o.result);
    return '';
  }
  return String(v).trim();
}

/**
 * Excel turns a typed 01XXXXXXXXX into the NUMBER 1XXXXXXXXX, dropping the
 * leading zero, which the shared normalizer (rightly) rejects. Put it back
 * before normalizing.
 */
export function normalizeImportPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, '');
  return toBdCompact(/^1[3-9]\d{8}$/.test(digits) ? `0${digits}` : raw);
}

function toDate(v: unknown): Date | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'object' && !(v instanceof Date)) {
    const o = v as { result?: unknown };
    return o.result !== undefined ? toDate(o.result) : undefined;
  }
  let d: Date | undefined;
  if (v instanceof Date) d = v;
  else if (typeof v === 'number') d = v > 20000 && v < 80000 ? new Date(Date.UTC(1899, 11, 30) + v * 86_400_000) : undefined;
  else {
    const s = String(v).trim();
    // Day-first, as dates are written in Bangladesh: 15/07/2026.
    const dmy = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/);
    d = dmy ? new Date(Date.UTC(+dmy[3], +dmy[2] - 1, +dmy[1])) : new Date(s);
  }
  return d && !Number.isNaN(d.getTime()) && d.getUTCFullYear() > 1900 && d.getUTCFullYear() < 2100 ? d : undefined;
}

function toEnum<T extends string>(raw: string, options: Record<string, T>): T | undefined {
  const key = raw.toUpperCase().replace(/[^A-Z]+/g, '_').replace(/^_|_$/g, '');
  return (Object.values(options) as string[]).includes(key) ? (key as T) : undefined;
}

function isYes(v: string | undefined): boolean {
  return !!v && /^(yes|y|true|1|✓|✔|★|⭐)$/i.test(v);
}
