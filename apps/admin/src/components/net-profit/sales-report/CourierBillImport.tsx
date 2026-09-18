"use client";
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  importCourierBill,
  type BillImportResult,
} from "@/hooks/useSalesReportV2";
import { COLORS, courierLabel } from "./format";

export function CourierBillImport({ couriers }: { couriers: string[] }) {
  const qc = useQueryClient();
  const [provider, setProvider] = useState(couriers[0] ?? "STEADFAST");
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<BillImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="grid gap-2.5">
      <div className="flex flex-wrap items-center gap-2.5">
        <select
          aria-label="Courier"
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="min-h-[34px] rounded-[7px] border px-2 text-sm"
          style={{ borderColor: COLORS.line }}
        >
          {couriers.map((c) => (
            <option key={c} value={c}>
              {courierLabel(c)}
            </option>
          ))}
        </select>
        <input
          type="file"
          accept=".csv,text/csv"
          aria-label="Courier statement CSV"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <button
          type="button"
          disabled={!file || busy}
          onClick={async () => {
            if (!file) return;
            setBusy(true);
            setError(null);
            setResult(null);
            try {
              setResult(await importCourierBill(provider, file));
              qc.invalidateQueries({ queryKey: ["sales-report-v2"] });
            } catch (e) {
              setError(e instanceof Error ? e.message : "Import failed");
            } finally {
              setBusy(false);
            }
          }}
          className="rounded-lg border px-3.5 py-1 text-sm font-semibold text-white disabled:opacity-40"
          style={{ background: COLORS.green, borderColor: COLORS.green }}
        >
          {busy ? "Importing…" : "Import statement"}
        </button>
      </div>
      {error && (
        <p
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: COLORS.lossWash, color: COLORS.loss }}
        >
          {error}
        </p>
      )}
      {result && (
        <p
          className="rounded-lg px-3 py-2 text-sm"
          style={{ background: COLORS.gainWash, color: COLORS.gain }}
        >
          {result.rows} parcel(s) in the file, {result.updated} matched and
          updated.
          {result.unmatched.length > 0 && (
            <span style={{ color: COLORS.amber }}>
              {" "}
              {result.unmatched.length} not found:{" "}
              {result.unmatched.slice(0, 10).join(", ")}
              {result.unmatched.length > 10 ? "…" : ""}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
