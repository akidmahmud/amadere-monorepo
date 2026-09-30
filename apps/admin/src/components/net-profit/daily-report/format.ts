export const money = (n: number) =>
  n.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
export const qty = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 3 });
/** Today in Asia/Dhaka (UTC+6, no DST), YYYY-MM-DD. */
export const dhakaToday = () =>
  new Date(Date.now() + 6 * 3600_000).toISOString().slice(0, 10);
export const inputClass =
  "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";
