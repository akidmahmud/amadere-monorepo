export const money = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const qty = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 3 });
/** The open business day, YYYY-MM-DD. A day runs 8 PM → 8 PM Dhaka (UTC+6, no
 *  DST) and carries the date it closes on, so after 8 PM "today" is tomorrow.
 *  Twin of the backend's currentBusinessDay (daily-report/period.ts). */
export const dhakaToday = () =>
  new Date(Date.now() + (6 + 4) * 3600_000).toISOString().slice(0, 10);
export const inputClass =
  "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
