"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";

export type PosTier = {
  key: string;
  name: string;
  minOrders: number;
  minSpent: number;
  color: string;
};

export const usePosTiers = () =>
  useQuery({
    queryKey: ["pos-tiers"],
    queryFn: () => proxyFetch<PosTier[]>("/admin/pos/tiers"),
    staleTime: 60_000,
  });

export function TierBadge({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold"
      style={{ background: `${color}1a`, color }}
    >
      <Icon name="workspace_premium" size={14} />
      {name}
    </span>
  );
}

/** Customer Manager › Tiers: one list; a customer's tier is worked out per store. */
export function PosTiersTab({ canEdit }: { canEdit: boolean }) {
  const { data } = usePosTiers();
  if (!data) return <div className="p-4 text-sm text-gray-500">Loading…</div>;
  return <Editor initial={data} canEdit={canEdit} />;
}

function Editor({
  initial,
  canEdit,
}: {
  initial: PosTier[];
  canEdit: boolean;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [rows, setRows] = useState(initial);
  const save = useMutation({
    mutationFn: () =>
      proxyFetch<PosTier[]>("/admin/pos/tiers", {
        method: "PUT",
        body: JSON.stringify({
          tiers: rows.map((r) => ({ ...r, key: r.key || undefined })),
        }),
      }),
    onSuccess: (saved) => {
      setRows(saved);
      qc.invalidateQueries({ queryKey: ["pos-tiers"] });
      qc.invalidateQueries({ queryKey: ["pos-customer-list"] });
      toast.push("Tiers saved", "success");
    },
    onError: (e) => toast.push(e.message),
  });
  const set = (i: number, patch: Partial<PosTier>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const move = (i: number, d: -1 | 1) =>
    setRows((rs) => {
      const n = [...rs];
      [n[i], n[i + d]] = [n[i + d], n[i]];
      return n;
    });
  const box =
    "h-10 rounded-lg border border-gray-200 px-3 text-sm outline-none focus:border-[#1d7a46] disabled:bg-gray-50";

  return (
    <div className="space-y-4 p-2">
      <p className="flex items-start gap-2 text-sm text-gray-600">
        <Icon
          name="info"
          size={18}
          className="mt-0.5 shrink-0 text-[#1d7a46]"
        />
        <span>
          List tiers from lowest to highest. A customer reaches a tier with
          <b> enough purchases OR enough spent</b> at a store (0 = not used);
          the highest one they reach is theirs. Tiers are counted per store,
          from completed sales only.
        </span>
      </p>
      <div className="overflow-x-auto rounded-xl">
        <table className="w-full text-sm">
          <thead className="bg-[#1d7a46] text-left text-white">
            <tr>
              <th className="px-4 py-3 font-bold">Tier</th>
              <th className="px-3 font-bold">Min. purchases</th>
              <th className="px-3 font-bold">or min. spent (৳)</th>
              <th className="px-3 font-bold">Colour</th>
              <th className="px-3 font-bold">Looks like</th>
              <th className="px-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i} className="border-b border-gray-100">
                <td className="px-4 py-2">
                  <input
                    className={`${box} w-40`}
                    value={r.name}
                    disabled={!canEdit}
                    onChange={(e) => set(i, { name: e.target.value })}
                    aria-label={`Tier ${i + 1} name`}
                  />
                </td>
                <td className="px-3">
                  <input
                    className={`${box} w-28`}
                    inputMode="numeric"
                    value={r.minOrders}
                    disabled={!canEdit}
                    onChange={(e) =>
                      set(i, {
                        minOrders:
                          Number(e.target.value.replace(/\D/g, "")) || 0,
                      })
                    }
                    aria-label={`Tier ${i + 1} minimum purchases`}
                  />
                </td>
                <td className="px-3">
                  <input
                    className={`${box} w-32`}
                    inputMode="decimal"
                    value={r.minSpent}
                    disabled={!canEdit}
                    onChange={(e) =>
                      set(i, {
                        minSpent:
                          Number(e.target.value.replace(/[^\d.]/g, "")) || 0,
                      })
                    }
                    aria-label={`Tier ${i + 1} minimum spent`}
                  />
                </td>
                <td className="px-3">
                  <input
                    type="color"
                    value={r.color}
                    disabled={!canEdit}
                    onChange={(e) => set(i, { color: e.target.value })}
                    className="h-10 w-14 cursor-pointer rounded-lg border border-gray-200 bg-white p-1"
                    aria-label={`Tier ${i + 1} colour`}
                  />
                </td>
                <td className="px-3">
                  <TierBadge name={r.name || "—"} color={r.color} />
                </td>
                <td className="px-3 text-right">
                  {canEdit && (
                    <span className="flex justify-end gap-1">
                      <button
                        className="grid h-8 w-8 place-items-center rounded-lg hover:bg-gray-100 disabled:opacity-30"
                        disabled={i === 0}
                        onClick={() => move(i, -1)}
                        aria-label="Move up"
                      >
                        <Icon name="arrow_upward" size={18} />
                      </button>
                      <button
                        className="grid h-8 w-8 place-items-center rounded-lg hover:bg-gray-100 disabled:opacity-30"
                        disabled={i === rows.length - 1}
                        onClick={() => move(i, 1)}
                        aria-label="Move down"
                      >
                        <Icon name="arrow_downward" size={18} />
                      </button>
                      <button
                        className="grid h-8 w-8 place-items-center rounded-lg text-red-600 hover:bg-red-50 disabled:opacity-30"
                        disabled={rows.length <= 1}
                        onClick={() =>
                          setRows((rs) => rs.filter((_, j) => j !== i))
                        }
                        aria-label={`Delete tier ${r.name}`}
                      >
                        <Icon name="delete" size={18} />
                      </button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {canEdit ? (
        <div className="flex gap-2">
          <button
            className="flex h-10 items-center gap-1 rounded-lg border border-gray-200 px-4 text-sm font-semibold"
            disabled={rows.length >= 10}
            onClick={() =>
              setRows((rs) => [
                ...rs,
                {
                  key: "",
                  name: "",
                  minOrders: 0,
                  minSpent: 0,
                  color: "#1d7a46",
                },
              ])
            }
          >
            <Icon name="add" size={18} /> Add tier
          </button>
          <button
            className="h-10 rounded-lg bg-[#1d7a46] px-5 text-sm font-bold text-white disabled:opacity-50"
            disabled={save.isPending || rows.some((r) => !r.name.trim())}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save tiers"}
          </button>
        </div>
      ) : (
        <p className="text-xs text-gray-500">
          Only staff with POS Settings access can change tiers.
        </p>
      )}
    </div>
  );
}
