"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Button, Modal } from "@amader/admin-ui";
import { useGenerateDailyReport } from "@/hooks/useDailyReports";
import { dhakaToday, inputClass } from "./format";

export function GenerateModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const today = dhakaToday();
  const [name, setName] = useState("");
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  // Off = 8 PM business days; on = the exact times below.
  const [timed, setTimed] = useState(false);
  const [fromTime, setFromTime] = useState("00:00");
  const [toTime, setToTime] = useState("23:59");
  const [error, setError] = useState<string | null>(null);
  const gen = useGenerateDailyReport();
  const router = useRouter();

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const r = await gen.mutateAsync({
        name: name.trim(),
        from,
        to,
        ...(timed ? { fromTime, toTime } : {}),
      });
      onClose();
      router.push(`/net-profit/daily-report/${r.id}`);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Could not generate the report.",
      );
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Generate report">
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold">
          Report name
          <input
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={120}
            required
            placeholder="e.g. Eid campaign week"
          />
        </label>
        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
            From
            <input
              type="date"
              className={inputClass}
              value={from}
              max={to || today}
              onChange={(e) => setFrom(e.target.value)}
              required
            />
          </label>
          <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
            To
            <input
              type="date"
              className={inputClass}
              value={to}
              min={from}
              max={today}
              onChange={(e) => setTo(e.target.value)}
              required
            />
          </label>
        </div>
        <label className="flex items-center gap-2 text-sm font-semibold">
          <input
            type="checkbox"
            checked={timed}
            onChange={(e) => setTimed(e.target.checked)}
          />
          Set exact times
        </label>
        {timed && (
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
              From time
              <input
                type="time"
                className={inputClass}
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                required
              />
            </label>
            <label className="flex flex-1 flex-col gap-1 text-sm font-semibold">
              To time (included)
              <input
                type="time"
                className={inputClass}
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                required
              />
            </label>
          </div>
        )}
        <p className="text-xs text-muted">
          {timed
            ? "The report covers exactly From date + time up to To date + time (Dhaka time)."
            : "Each day runs 8 PM to 8 PM (2 Oct = 1 Oct 8 PM to 2 Oct 8 PM)."}{" "}
          Choosing today gives the sales so far. A report can cover up to 92
          days.
        </p>
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" disabled={gen.isPending || !name.trim()}>
            {gen.isPending ? "Generating…" : "Generate"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
