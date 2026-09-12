/**
 * Named date-range presets -> a concrete {from,to} ISO window.
 *
 * Lifted out of the Recovery page so the Recovered Orders list can filter by
 * the same windows without a second copy of the arithmetic.
 */

const ROLLING_WINDOW_HOURS: Record<string, number> = {
  "1h": 1,
  "6h": 6,
  "12h": 12,
  "24h": 24,
  "7d": 7 * 24,
  "30d": 30 * 24,
  "90d": 90 * 24,
};

function parseCustomBound(value: string, edge: "start" | "end"): Date {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!dateOnly) return new Date(value);
  return new Date(
    edge === "start" ? `${value}T00:00:00.000` : `${value}T23:59:59.999`,
  );
}

export function resolveDateRange(
  value: string | undefined,
  customFrom?: string,
  customTo?: string,
): { from?: string; to?: string } {
  if (value === "custom") {
    if (!customFrom || !customTo) return {};
    return {
      from: parseCustomBound(customFrom, "start").toISOString(),
      to: parseCustomBound(customTo, "end").toISOString(),
    };
  }
  if (!value) return {};
  const to = new Date();
  if (value === "today") {
    // Calendar day (local midnight to now), not a rolling 24h window — at 2am
    // a rolling "Today" swallows nearly all of yesterday. "24h" is the rolling
    // one for anyone who wants that.
    const from = new Date(
      to.getFullYear(),
      to.getMonth(),
      to.getDate(),
      0,
      0,
      0,
      0,
    );
    return { from: from.toISOString(), to: to.toISOString() };
  }
  const hours = ROLLING_WINDOW_HOURS[value];
  if (!hours) return {};
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);
  return { from: from.toISOString(), to: to.toISOString() };
}
