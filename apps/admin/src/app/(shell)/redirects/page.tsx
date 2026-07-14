"use client";

import { useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { useCreateRedirect, useDeleteRedirect, useRedirects, useUpdateRedirect, type Redirect } from "@/hooks/useRedirects";

const STATUS_CODES = [301, 302, 307, 308] as const;

function NewRedirectForm({ onDone }: { onDone: () => void }) {
  const [fromPath, setFromPath] = useState("");
  const [toPath, setToPath] = useState("");
  const [statusCode, setStatusCode] = useState<(typeof STATUS_CODES)[number]>(301);
  const create = useCreateRedirect();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ fromPath, toPath, statusCode, isActive: true });
    onDone();
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">From path</span>
          <input required value={fromPath} onChange={(e) => setFromPath(e.target.value)} placeholder="/old-page" className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">To path</span>
          <input required value={toPath} onChange={(e) => setToPath(e.target.value)} placeholder="/new-page" className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Status</span>
          <select value={statusCode} onChange={(e) => setStatusCode(Number(e.target.value) as (typeof STATUS_CODES)[number])} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500">
            {STATUS_CODES.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </label>
        <Button type="submit" variant="primary" disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Add redirect"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </form>
    </Card>
  );
}

function RedirectRow({ redirect }: { redirect: Redirect }) {
  const update = useUpdateRedirect(redirect.id);
  const deleteRedirect = useDeleteRedirect();

  return (
    <Card className="flex items-center gap-3">
      <div className="min-w-0 flex-1 text-sm text-text">
        <span className="num">{redirect.fromPath}</span> → <span className="num">{redirect.toPath}</span>
        <span className="ml-2 text-xs text-muted">({redirect.statusCode})</span>
      </div>
      <label className="flex items-center gap-1.5 text-xs text-secondary">
        <input
          type="checkbox"
          checked={redirect.isActive}
          onChange={(e) => update.mutate({ isActive: e.target.checked })}
        />
        Active
      </label>
      <Button
        type="button"
        variant="ghost"
        onClick={() => {
          if (confirm(`Delete redirect ${redirect.fromPath} → ${redirect.toPath}?`)) deleteRedirect.mutate(redirect.id);
        }}
      >
        Delete
      </Button>
    </Card>
  );
}

export default function RedirectsPage() {
  const { data: redirects, isLoading } = useRedirects();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{redirects?.length ?? 0} redirects</p>
        {!creating && <Button variant="primary" onClick={() => setCreating(true)}>Add redirect</Button>}
      </div>

      {creating && <NewRedirectForm onDone={() => setCreating(false)} />}
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {redirects && redirects.length === 0 && !creating && <p className="text-sm text-muted">No redirects yet.</p>}

      <div className="flex flex-col gap-3">
        {redirects?.map((r) => <RedirectRow key={r.id} redirect={r} />)}
      </div>
    </>
  );
}
