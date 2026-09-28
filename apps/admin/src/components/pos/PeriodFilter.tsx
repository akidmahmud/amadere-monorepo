"use client";

import { Icon } from "@amader/admin-ui";

export type Period = {
  from: string;
  to: string;
  fromTime: string;
  toTime: string;
};
export const NO_PERIOD: Period = { from: "", to: "", fromTime: "", toTime: "" };

const box =
  "flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm";

/** From [date][time] To [date][time] — Dhaka time; any part can be left blank. */
export function PeriodFilter({
  value,
  onChange,
}: {
  value: Period;
  onChange: (p: Period) => void;
}) {
  const set = (k: keyof Period, v: string) => onChange({ ...value, [k]: v });
  return (
    <>
      <label className={box}>
        <Icon name="calendar_month" size={20} className="text-[#1d7a46]" />
        <span className="text-gray-600">From</span>
        <input
          type="date"
          value={value.from}
          onChange={(e) => set("from", e.target.value)}
          className="bg-transparent outline-none"
          aria-label="From date"
        />
        <Icon name="schedule" size={18} className="text-[#1d7a46]" />
        <input
          type="time"
          value={value.fromTime}
          onChange={(e) => set("fromTime", e.target.value)}
          className="bg-transparent outline-none"
          aria-label="From time"
        />
      </label>
      <span className="text-sm text-gray-600">To</span>
      <label className={box}>
        <Icon name="calendar_month" size={20} className="text-[#1d7a46]" />
        <input
          type="date"
          value={value.to}
          min={value.from || undefined}
          onChange={(e) => set("to", e.target.value)}
          className="bg-transparent outline-none"
          aria-label="To date"
        />
        <Icon name="schedule" size={18} className="text-[#1d7a46]" />
        <input
          type="time"
          value={value.toTime}
          onChange={(e) => set("toTime", e.target.value)}
          className="bg-transparent outline-none"
          aria-label="To time"
        />
      </label>
    </>
  );
}

/** Query params for the POS manager APIs (blank parts are dropped). */
export const periodParams = (p: Period) => ({
  from: p.from,
  to: p.to || p.from,
  fromTime: p.fromTime,
  toTime: p.toTime,
});
