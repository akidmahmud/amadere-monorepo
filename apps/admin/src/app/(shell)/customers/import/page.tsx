"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";

const importIcon = <Icon name="upload_file" />;

export default function CustomerImportPage() {
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
    <div className="flex flex-col gap-4">
      <PageHeader icon={importIcon} title="Import Customers" subtitle="Bulk-add existing customers from a CSV file." />

      <Card className="flex flex-col gap-4">
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
          <Button type="button" variant="primary" onClick={() => fileRef.current?.click()} disabled={pending}>
            {pending ? "Importing…" : "Choose CSV file"}
          </Button>
          <p className="mt-2 text-xs text-muted">Columns: name,phone,email,dob (dob optional, YYYY-MM-DD). Rows with a phone that already exists are skipped.</p>
        </div>
        {result && (
          <p className="text-sm text-success">
            Imported {result.imported}, skipped {result.skipped}.
          </p>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
      </Card>
    </div>
  );
}
