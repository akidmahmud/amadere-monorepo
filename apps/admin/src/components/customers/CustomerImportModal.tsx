"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@amader/admin-ui";

const GREEN = "#2e7d43";
const GREEN_DARK = "#1d5230";
const LINE = "#e5ebe6";
const MUTED = "#64766b";

interface ImportResult {
  dryRun: boolean;
  totalRows: number;
  created: number;
  updated: number;
  unchanged: number;
  skipped: number;
  skippedRows: { row: number; reason: string }[];
  warnings: string[];
}

// Two steps: the file is first sent as a dry run (nothing saved) and the
// report shown; only "Import" re-sends the same file for real. Safe to repeat
// with the same workbook — existing customers are matched by phone and only
// their empty fields are filled.
export function CustomerImportModal({
  onClose,
  endpoint = "/api/backend/admin/customers/import",
  queryKey = ["customers"],
  title = "Import Customers",
}: {
  onClose: () => void;
  endpoint?: string;
  /** List to refresh after a real import. */
  queryKey?: string[];
  title?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [file, setFile] = useState<File | null>(null);
  const [pending, setPending] = useState<"preview" | "import" | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send(f: File, dryRun: boolean) {
    setPending(dryRun ? "preview" : "import");
    setError(null);
    try {
      const form = new FormData();
      form.append("file", f);
      const res = await fetch(`${endpoint}?dryRun=${dryRun}`, { method: "POST", body: form });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? "Import failed");
      setResult(body.data);
      if (!dryRun) qc.invalidateQueries({ queryKey });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
      if (dryRun) setResult(null);
    } finally {
      setPending(null);
    }
  }

  const preview = result?.dryRun ? result : null;
  const done = result && !result.dryRun ? result : null;

  return (
    <Modal open onClose={onClose} title={title}>
      <div className="flex flex-col gap-4">
        <p className="text-[0.8rem] font-medium" style={{ color: MUTED }}>
          Upload the customer spreadsheet (.xlsx) as it is, or a .csv. Columns are matched by their header (Name, Number,
          Assign to, Priority, Status…). Customers are matched by phone: nobody is duplicated, and existing customers only
          get fields that are still empty. Nothing is saved until you press Import.
        </p>

        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = "";
            if (!f) return;
            setFile(f);
            setResult(null);
            send(f, true);
          }}
        />

        {!done && (
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={pending !== null}
              className="inline-flex h-10 items-center gap-2 rounded-[10px] border px-4 text-[0.82rem] font-bold disabled:opacity-70"
              style={{ borderColor: LINE, color: "#374840" }}
            >
              {pending === "preview" ? "Checking file…" : file ? "Choose another file" : "Choose file"}
            </button>
            {file && <span className="text-[0.78rem] font-semibold" style={{ color: MUTED }}>{file.name}</span>}
          </div>
        )}

        {preview && (
          <div className="rounded-[9px] border px-3.5 py-3 text-[0.8rem]" style={{ borderColor: LINE }}>
            <p className="mb-2 font-bold text-text">Preview: {preview.totalRows} rows in the file</p>
            <ul className="flex flex-col gap-1 font-semibold" style={{ color: "#374840" }}>
              <li>{preview.created} new customers will be added</li>
              <li>{preview.updated} existing customers will get empty fields filled</li>
              <li>{preview.unchanged} existing customers have nothing new (left as they are)</li>
              <li>{preview.skipped} rows will be skipped</li>
            </ul>
          </div>
        )}

        {done && (
          <p className="rounded-[9px] border px-3.5 py-2.5 text-[0.8rem] font-semibold" style={{ background: "#e3f4e6", borderColor: "#c8e8cf", color: "#1f7a33" }}>
            Import complete: {done.created} added, {done.updated} updated, {done.unchanged} unchanged, {done.skipped} skipped.
          </p>
        )}

        {result && result.warnings.length > 0 && (
          <div className="rounded-[9px] border px-3.5 py-2.5 text-[0.76rem]" style={{ background: "#fff8e6", borderColor: "#f3dfa8", color: "#8a5a00" }}>
            <p className="mb-1 font-bold">Notes</p>
            <ul className="list-disc pl-4">
              {result.warnings.map((w) => <li key={w}>{w}</li>)}
            </ul>
          </div>
        )}

        {result && result.skippedRows.length > 0 && (
          <details className="text-[0.76rem]" style={{ color: MUTED }}>
            <summary className="cursor-pointer font-semibold">Skipped rows ({result.skipped})</summary>
            <ul className="mt-1 max-h-40 overflow-y-auto pl-4">
              {result.skippedRows.map((s) => <li key={s.row}>Row {s.row}: {s.reason}</li>)}
            </ul>
          </details>
        )}

        {error && (
          <p className="rounded-[9px] border px-3.5 py-2.5 text-[0.8rem] font-semibold" style={{ background: "#feeaec", borderColor: "#f8ccd3", color: "#e8465e" }}>
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-[10px] border px-4 text-[0.8rem] font-bold" style={{ borderColor: LINE, color: "#374840" }}>
            {done ? "Done" : "Cancel"}
          </button>
          {preview && file && (preview.created > 0 || preview.updated > 0) && (
            <button
              type="button"
              onClick={() => send(file, false)}
              disabled={pending !== null}
              className="inline-flex h-10 items-center rounded-[10px] px-4 text-[0.82rem] font-bold text-white disabled:opacity-70"
              style={{ background: GREEN }}
              onMouseEnter={(e) => !pending && (e.currentTarget.style.background = GREEN_DARK)}
              onMouseLeave={(e) => (e.currentTarget.style.background = GREEN)}
            >
              {pending === "import" ? "Importing…" : `Import ${preview.created + preview.updated} customers`}
            </button>
          )}
        </div>
      </div>
    </Modal>
  );
}
