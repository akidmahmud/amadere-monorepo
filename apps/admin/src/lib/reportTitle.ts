// Pure helpers behind every report export (tests/report-export.test.mjs).
// Kept free of exceljs / DOM so node --test can load this file directly.

export type Cell = string | number;

const COMPANY = "Amader eBuy Limited";

/** "2026-08-18" → "Aug 18, 2026". Read as a calendar day, never shifted by timezone. */
function fmtDay(day: string): string {
  return new Date(`${day}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

/** Splits "YYYY-MM-DD" or "YYYY-MM-DDTHH:mm[:ss]" into its day and HH:mm. */
function split(
  v: string | undefined,
  time?: string,
): { day?: string; time?: string } {
  if (!v) return {};
  const [day, t] = v.split("T");
  return { day, time: (time || t || "").slice(0, 5) || undefined };
}

export interface TitleRange {
  from?: string;
  to?: string;
  /** HH:mm, when the date itself carries none (the Sales Report's separate time boxes). */
  fromTime?: string;
  toTime?: string;
}

/**
 * The title row every export opens with, e.g.
 *   "Amader eBuy Limited - Aug 18, 2026 - Sales Report"
 *   "Amader eBuy Limited - Aug 18, 2026 09:00 to 12:00 - Sales Report"
 *   "Amader eBuy Limited - Aug 12, 2026 to Aug 18, 2026 - Retail Orders"
 * With no range at all it is dated the day of export, so a printed sheet
 * still says when it was pulled.
 */
export function reportTitle(
  name: string,
  range: TitleRange = {},
  today = new Date(),
): string {
  const a = split(range.from, range.fromTime);
  const b = split(range.to, range.toTime);
  const start = a.day ?? b.day;
  const end = b.day ?? a.day;
  let when: string;
  if (!start || !end) {
    when = fmtDay(
      new Date(today.getTime() + 6 * 3600_000).toISOString().slice(0, 10),
    );
  } else if (start === end) {
    const times =
      a.time || b.time ? ` ${a.time ?? "00:00"} to ${b.time ?? "23:59"}` : "";
    when = `${fmtDay(start)}${times}`;
  } else {
    when = `${fmtDay(start)}${a.time ? ` ${a.time}` : ""} to ${fmtDay(end)}${b.time ? ` ${b.time}` : ""}`;
  }
  return `${COMPANY} - ${when} - ${name}`;
}

/** Browser-local "YYYY-MM-DDTHH:mm". */
export function localStamp(d: Date): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

/**
 * Title range for the list pages whose date filter is a preset or a custom
 * pair (Order Manager, both wholesale dashboards): a custom range as picked,
 * "Today" as the day alone, a rolling window ("Last 12 hours") with its clock
 * times — the only honest way to say what it covered.
 */
export function presetTitleRange(
  preset: string | undefined,
  customFrom: string | undefined,
  customTo: string | undefined,
  resolved: { from?: string; to?: string },
  now = new Date(),
): TitleRange {
  if (preset === "custom") return { from: customFrom, to: customTo };
  if (preset === "today") {
    const t = localStamp(now).slice(0, 10);
    return { from: t, to: t };
  }
  return resolved.from && resolved.to
    ? {
        from: localStamp(new Date(resolved.from)),
        to: localStamp(new Date(resolved.to)),
      }
    : {};
}

/**
 * RFC 4180 CSV → rows: quoted fields, "" escapes, commas/newlines inside
 * quotes, CRLF, and the UTF-8 BOM our exporters prepend for Excel.
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const s = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (quoted) {
      if (ch === '"' && s[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else field += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && s[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += ch;
  }
  if (field !== "" || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

/**
 * Plain amounts/counts become real numbers so Excel can sum them. Phone
 * numbers, IDs with leading zeros and anything 11+ digits stay text.
 * ponytail: shape heuristic, not per-column types — add a column list if a
 * numeric-looking code ever needs to stay text.
 */
export function toCell(v: string): Cell {
  return /^-?(0|[1-9]\d{0,9})(\.\d+)?$/.test(v) ? Number(v) : v;
}
