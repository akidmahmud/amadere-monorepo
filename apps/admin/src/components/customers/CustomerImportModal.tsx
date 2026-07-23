"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Modal } from "@amader/admin-ui";

const GREEN = "#2e7d43";
const GREEN_DARK = "#1d5230";
const LINE = "#e5ebe6";
const MUTED = "#64766b";

export function CustomerImportModal({ onClose }: { onClose: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null);
  const qc = useQueryClient();
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{ imported: number; skipped: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(file: File) {
    setPending(true);
    setError(null);
    setResult(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/backend/admin/customers/import", { method: "POST", body: form });
      const body = await res.json();
      if (!body.success) throw new Error(body.error?.message ?? "Import failed");
      setResult(body.data);
      qc.invalidateQueries({ queryKey: ["customers"] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Modal open onClose={onClose} title="Import Customers">
      <div className="flex flex-col gap-4">
        <p className="text-[0.8rem] font-medium" style={{ color: MUTED }}>
          Bulk-add existing customers from a CSV file. Columns: name,phone,email,dob (dob optional, YYYY-MM-DD). Rows
          with a phone that already exists are skipped.
        </p>

        <div>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={pending}
            className="inline-flex h-10 items-center gap-2 rounded-[10px] px-4 text-[0.82rem] font-bold text-white disabled:opacity-70"
            style={{ background: GREEN }}
            onMouseEnter={(e) => !pending && (e.currentTarget.style.background = GREEN_DARK)}
            onMouseLeave={(e) => (e.currentTarget.style.background = GREEN)}
          >
            {pending ? "Importing…" : "Choose CSV file"}
          </button>
        </div>

        {result && (
          <p className="rounded-[9px] border px-3.5 py-2.5 text-[0.8rem] font-semibold" style={{ background: "#e3f4e6", borderColor: "#c8e8cf", color: "#1f7a33" }}>
            Imported {result.imported}, skipped {result.skipped}.
          </p>
        )}
        {error && (
          <p className="rounded-[9px] border px-3.5 py-2.5 text-[0.8rem] font-semibold" style={{ background: "#feeaec", borderColor: "#f8ccd3", color: "#e8465e" }}>
            {error}
          </p>
        )}

        <div className="flex justify-end">
          <button type="button" onClick={onClose} className="inline-flex h-10 items-center rounded-[10px] border px-4 text-[0.8rem] font-bold" style={{ borderColor: LINE, color: "#374840" }}>
            Done
          </button>
        </div>
      </div>
    </Modal>
  );
}
