"use client";

import { useState } from "react";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { canActFor } from "@/lib/pos-transfer";
import { useStockPost, useTransfers, type Transfer } from "@/hooks/usePos";
import type { PosProduct } from "@/lib/pos-cart";
import { usePosContext } from "@/components/pos/PosContext";
import {
  PosSubPage,
  ProductPicker,
  card,
  input,
  primaryBtn,
  productLabel,
} from "@/components/pos/PosSubPage";

type Line = { p: PosProduct; qty: string };
type TransferRow = Transfer;

const STATUS_STYLE: Record<Transfer["status"], string> = {
  REQUESTED: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  DISPATCHED: "bg-violet-100 text-violet-800",
  RECEIVED: "bg-emerald-100 text-emerald-800",
  CANCELLED: "bg-gray-100 text-gray-600",
};

export default function TransfersPage() {
  const { storeId, store, stores, can, allStores } = usePosContext();
  const toast = useToast();
  const list = useTransfers(allStores ? undefined : storeId);
  const [to, setTo] = useState<number | "">("");
  const [lines, setLines] = useState<Line[]>([]);
  const [note, setNote] = useState("");
  const create = useStockPost("/admin/stock/transfers");
  const [receiving, setReceiving] = useState<TransferRow | null>(null);
  const [busy, setBusy] = useState(false);

  const DONE: Record<string, string> = {
    approve: "approved",
    dispatch: "dispatched",
    cancel: "cancelled",
    receive: "received",
  };
  const doAction = async (
    id: number,
    action: "approve" | "dispatch" | "cancel" | "receive",
    body?: unknown,
  ) => {
    if (busy) return;
    setBusy(true);
    try {
      await proxyFetch(`/admin/stock/transfers/${id}/${action}`, {
        method: "POST",
        body: JSON.stringify(body ?? {}),
      });
      toast.push(`Transfer ${DONE[action]}`, "success");
      list.refetch();
      setReceiving(null);
    } catch (e) {
      toast.push((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const mine = (id: number) =>
    canActFor({ allStores, myStoreId: store?.id }, id);
  const valid =
    to !== "" &&
    lines.length > 0 &&
    lines.every((l) => Number(l.qty) > 0 && Number(l.qty) <= l.p.stock);

  return (
    <PosSubPage title="Transfers" permission="pos.transfer">
      <div className={`${card} space-y-4`}>
        <h2 className="font-bold">
          New transfer from {store?.name ?? "your store"}
        </h2>
        <select
          value={to}
          onChange={(e) => setTo(e.target.value ? Number(e.target.value) : "")}
          className={`${input} w-full`}
        >
          <option value="">Send to store…</option>
          {stores
            .filter((s) => s.id !== store?.id && s.isActive)
            .map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
        </select>
        <ProductPicker
          onPick={(p) =>
            setLines((ls) =>
              ls.some(
                (l) =>
                  l.p.productId === p.productId &&
                  l.p.variantId === p.variantId,
              )
                ? ls
                : [...ls, { p, qty: "1" }],
            )
          }
        />
        {lines.map((l, i) => (
          <div
            key={`${l.p.productId}:${l.p.variantId ?? 0}`}
            className="flex items-center gap-3 text-sm"
          >
            <span className="flex-1">
              {productLabel(l.p)}{" "}
              <span className="text-xs text-gray-400">have {l.p.stock}</span>
            </span>
            <input
              value={l.qty}
              onChange={(e) =>
                setLines((ls) =>
                  ls.map((x, j) =>
                    j === i ? { ...x, qty: e.target.value } : x,
                  ),
                )
              }
              inputMode="numeric"
              className={`${input} w-24`}
              aria-label="Quantity"
            />
            <button
              onClick={() => setLines((ls) => ls.filter((_, j) => j !== i))}
              aria-label="Remove"
              className="text-gray-400 hover:text-red-500"
            >
              <Icon name="close" size={18} />
            </button>
          </div>
        ))}
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className={`${input} w-full`}
        />
        <button
          className={primaryBtn}
          disabled={!valid || create.isPending}
          onClick={() =>
            create.mutate(
              {
                fromStoreId: storeId,
                toStoreId: to,
                note: note.trim() || undefined,
                items: lines.map((l) => ({
                  productId: l.p.productId,
                  variantId: l.p.variantId ?? undefined,
                  qty: Number(l.qty),
                })),
              },
              {
                onSuccess: () => {
                  toast.push("Transfer requested", "success");
                  setLines([]);
                  setNote("");
                  setTo("");
                  list.refetch();
                },
                onError: (e) => toast.push(e.message),
              },
            )
          }
        >
          Request transfer
        </button>
      </div>

      <div className={`${card} mt-5 overflow-x-auto`}>
        <h2 className="mb-3 font-bold">Transfers</h2>
        {!list.data?.length && (
          <div className="text-sm text-gray-500">No transfers yet.</div>
        )}
        <table className="w-full text-sm">
          <tbody>
            {list.data?.map((t) => (
              <tr key={t.id} className="border-t border-gray-100 align-top">
                <td className="py-3 pr-3">
                  <div className="font-semibold">{t.number}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(t.createdAt).toLocaleString("en-GB")}
                  </div>
                </td>
                <td className="py-3 pr-3">
                  {t.fromStore.name} → {t.toStore.name}
                  <div className="text-xs text-gray-500">
                    {t.items
                      .map(
                        (i) =>
                          `${i.name} × ${i.qty}${i.receivedQty !== null && i.receivedQty !== i.qty ? ` (got ${i.receivedQty})` : ""}`,
                      )
                      .join(", ")}
                  </div>
                </td>
                <td className="py-3 pr-3">
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-bold ${STATUS_STYLE[t.status]}`}
                  >
                    {t.status}
                  </span>
                </td>
                <td className="py-3 text-right">
                  <div className="flex justify-end gap-2">
                    {t.status === "REQUESTED" &&
                      can("pos.transfer_approve") && (
                        <button
                          className="rounded-lg bg-[#1d7a46] px-3 py-1.5 text-xs font-bold text-white"
                          disabled={busy}
                          onClick={() => doAction(t.id, "approve")}
                        >
                          Approve
                        </button>
                      )}
                    {t.status === "APPROVED" && mine(t.fromStoreId) && (
                      <button
                        className="rounded-lg bg-[#1d7a46] px-3 py-1.5 text-xs font-bold text-white"
                        disabled={busy}
                        onClick={() => doAction(t.id, "dispatch")}
                      >
                        Dispatch
                      </button>
                    )}
                    {t.status === "DISPATCHED" && mine(t.toStoreId) && (
                      <button
                        className="rounded-lg bg-[#1d7a46] px-3 py-1.5 text-xs font-bold text-white"
                        onClick={() => setReceiving(t)}
                      >
                        Receive
                      </button>
                    )}
                    {(t.status === "REQUESTED" ||
                      t.status === "APPROVED" ||
                      // in transit: the sender can call it back
                      (t.status === "DISPATCHED" && mine(t.fromStoreId))) && (
                      <button
                        className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold"
                        onClick={() =>
                          window.confirm(`Cancel ${t.number}?`) &&
                          doAction(t.id, "cancel")
                        }
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {receiving && (
        <ReceiveDialog
          busy={busy}
          t={receiving}
          onClose={() => setReceiving(null)}
          onSubmit={(items) => doAction(receiving.id, "receive", { items })}
        />
      )}
    </PosSubPage>
  );
}

function ReceiveDialog({
  t,
  busy,
  onClose,
  onSubmit,
}: {
  t: TransferRow;
  busy: boolean;
  onClose: () => void;
  onSubmit: (items: { id: number; receivedQty: number }[]) => void;
}) {
  const [got, setGot] = useState<Record<number, string>>(
    Object.fromEntries(t.items.map((i) => [i.id, String(i.qty)])),
  );
  const valid = t.items.every((i) => {
    const n = Number(got[i.id]);
    return Number.isInteger(n) && n >= 0 && n <= i.qty;
  });
  return (
    <div
      className="fixed inset-0 z-40 grid place-items-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="mb-1 font-bold">Receive {t.number}</h3>
        <p className="mb-4 text-sm text-gray-500">
          Count what actually arrived. A shortfall is recorded, not added.
        </p>
        {t.items.map((i) => (
          <div key={i.id} className="mb-2 flex items-center gap-3 text-sm">
            <span className="flex-1">
              {i.name} <span className="text-gray-400">sent {i.qty}</span>
            </span>
            <input
              value={got[i.id]}
              onChange={(e) => setGot({ ...got, [i.id]: e.target.value })}
              inputMode="numeric"
              className={`${input} w-24`}
              aria-label={`Received ${i.name}`}
            />
          </div>
        ))}
        <div className="mt-4 flex justify-end gap-2">
          <button
            className="h-10 rounded-lg border border-gray-200 px-4 text-sm"
            onClick={onClose}
          >
            Close
          </button>
          <button
            className={primaryBtn}
            disabled={!valid || busy}
            onClick={() =>
              onSubmit(
                t.items.map((i) => ({
                  id: i.id,
                  receivedQty: Number(got[i.id]),
                })),
              )
            }
          >
            Confirm received
          </button>
        </div>
      </div>
    </div>
  );
}
