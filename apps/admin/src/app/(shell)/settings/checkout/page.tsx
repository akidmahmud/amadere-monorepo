"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@amader/admin-ui";
import { proxyFetch } from "@/lib/api/proxy-client";

/**
 * "Customise checkout" (plan §8.3).
 *
 * Lists checkout-kind pages, shows which one is live, and — the part that
 * matters most — gives the owner a prominent way back to the hardcoded
 * layout. That button is their undo at midnight when a published layout
 * misbehaves, so it is deliberately impossible to miss rather than tucked
 * into a menu.
 */

interface AdminPageRow {
  id: number;
  slug: string;
  kind?: string;
  isDefaultCheckout?: boolean;
}

export default function CheckoutSettingsPage() {
  const qc = useQueryClient();
  const [note, setNote] = useState<string | null>(null);

  const { data: pages, isLoading } = useQuery({
    queryKey: ["admin-pages", "checkout"],
    queryFn: async () => {
      const res = await proxyFetch<{ items?: AdminPageRow[] }>(
        "/admin/pages?pageSize=100",
      );
      return (res.items ?? []).filter((p) => p.kind === "CHECKOUT");
    },
  });

  const setLive = useMutation({
    mutationFn: (id: number) =>
      proxyFetch(`/admin/pages/${id}/set-default-checkout`, { method: "POST" }),
    onSuccess: () => {
      setNote("This layout is now live on /checkout.");
      qc.invalidateQueries({ queryKey: ["admin-pages"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const restore = useMutation({
    mutationFn: () =>
      proxyFetch("/admin/pages/checkout/restore-default", { method: "POST" }),
    onSuccess: () => {
      setNote("Restored. /checkout is back to the built-in layout.");
      qc.invalidateQueries({ queryKey: ["admin-pages"] });
    },
    onError: (e: Error) => setNote(e.message),
  });

  const live = pages?.find((p) => p.isDefaultCheckout);

  return (
    <div className="max-w-3xl">
      <h1 className="mb-1 text-2xl font-bold">Customise checkout</h1>
      <p className="mb-6 text-sm text-muted">
        Build an alternative checkout arrangement and switch to it. The built-in
        layout always stays available as a fallback.
      </p>

      {note && (
        <div className="mb-4 rounded-md border border-line bg-beige px-4 py-2.5 text-sm">
          {note}
        </div>
      )}

      <div className="mb-6 rounded-lg border border-line bg-white p-4">
        <div className="text-sm font-semibold">
          Currently live:{" "}
          {live ? (
            <span className="text-green">{live.slug}</span>
          ) : (
            <span className="text-muted">built-in layout (code)</span>
          )}
        </div>
        <p className="mt-1 text-xs text-muted">
          If a published layout ever renders wrong, restoring the built-in one
          takes effect immediately and cannot fail.
        </p>
        <Button
          type="button"
          // admin-ui has no danger variant; the emphasis comes from the copy
          // and placement rather than inventing a colour that exists nowhere
          // else in the panel.
          className="mt-3"
          disabled={!live || restore.isPending}
          onClick={() => restore.mutate()}
        >
          {restore.isPending ? "Restoring…" : "Restore default layout"}
        </Button>
      </div>

      <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted">
        Checkout layouts
      </h2>
      {isLoading ? (
        <p className="text-sm text-muted">Loading…</p>
      ) : !pages || pages.length === 0 ? (
        <p className="rounded-lg border border-dashed border-line p-6 text-center text-sm text-muted">
          No checkout layouts yet. Seed the starting layout with
          <code className="mx-1 rounded bg-beige px-1.5 py-0.5">
            pnpm --filter @amader/db exec tsx scripts/seed-checkout-layout.ts
          </code>
          then edit it in the builder.
        </p>
      ) : (
        <ul className="divide-y divide-line rounded-lg border border-line bg-white">
          {pages.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-4 py-3">
              <span className="font-medium">{p.slug}</span>
              {p.isDefaultCheckout && (
                <span className="rounded bg-green px-2 py-0.5 text-[11px] font-semibold text-white">
                  LIVE
                </span>
              )}
              <span className="ml-auto flex gap-2">
                <Link href={`/pages/${p.id}/builder`}>
                  <Button type="button" variant="ghost">
                    Builder
                  </Button>
                </Link>
                {!p.isDefaultCheckout && (
                  <Button
                    type="button"
                    disabled={setLive.isPending}
                    onClick={() => setLive.mutate(p.id)}
                  >
                    Set as live
                  </Button>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
