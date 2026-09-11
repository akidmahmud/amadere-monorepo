"use client";

import { useEffect, useState } from "react";
import { Button, Modal } from "@amader/admin-ui";
import {
  useRecoveryEmailPreview,
  useSendRecoveryEmail,
  type RecoveryEmailOverride,
} from "@/hooks/useRecovery";
import { useDiscounts } from "@/hooks/useDiscounts";

const field =
  "w-full rounded-sm border border-border bg-surface px-3 py-2 text-sm text-text outline-none focus:border-brand-500";

/**
 * Preview-then-send for the abandoned-cart email, with the wording editable
 * for this one send.
 *
 * The preview is the server's own render, not a client-side approximation —
 * one renderer feeds both this and the send, so staff cannot approve one
 * email and mail another.
 *
 * Edits here are per-send and never written back: personalising one chase
 * must not silently rewrite the template everyone else uses. The saved
 * default lives in Recovery > Settings.
 */
export function RecoveryEmailModal({
  incompleteId,
  onClose,
}: {
  incompleteId: number;
  onClose: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<RecoveryEmailOverride>({});
  const [coupon, setCoupon] = useState("");

  // Only published COUPON codes. A PROMOTION applies itself and has no code to
  // print, and a draft or expired one would be rejected at checkout — the
  // server refuses those too, but not offering them is the kinder half.
  const { data: discounts } = useDiscounts({ page: 1, pageSize: 100 });
  const couponOptions = (discounts?.items ?? []).filter(
    (d) => d.type === "COUPON" && d.code && d.status === "PUBLISHED",
  );
  const [sent, setSent] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  // The coupon is part of the preview override, so picking one re-renders the
  // real email — staff see the voucher block exactly as the customer will.
  const { data, isLoading, error } = useRecoveryEmailPreview(incompleteId, {
    ...draft,
    couponCode: coupon || undefined,
  });
  const send = useSendRecoveryEmail();

  // Seed the editor from whatever the server actually used, so opening it
  // shows the real copy rather than an empty box.
  useEffect(() => {
    if (data && Object.keys(draft).length === 0) setDraft({ ...data.copy });
    // Only on first load; later edits are the user's own.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  function handleSend() {
    setFailure(null);
    send.mutate(
      { id: incompleteId, ...draft, couponCode: coupon || undefined },
      {
        onSuccess: (r) => {
          if (r.sent) {
            setSent(true);
            setTimeout(onClose, 1400);
          } else {
            setFailure(r.error ?? "Could not send");
          }
        },
        onError: (e) => setFailure(e instanceof Error ? e.message : "Could not send"),
      },
    );
  }

  return (
    <Modal open onClose={onClose} title="Send recovery email" tone="dark" className="max-w-3xl">
      {isLoading && !data && <p className="p-4 text-sm text-secondary">Building the email…</p>}

      {error && (
        <p className="p-4 text-sm text-danger">
          {error instanceof Error ? error.message : "Could not build the email"}
        </p>
      )}

      {data && (
        <div className="flex flex-col gap-3">
          <div className="flex items-start justify-between gap-3 rounded-inner bg-surface-2 p-3 text-xs">
            <div>
              <p className="text-secondary">
                To:{" "}
                <span className="font-semibold text-text">
                  {data.to ?? "— no email address on this cart —"}
                </span>
              </p>
              <p className="mt-1 text-secondary">
                Subject: <span className="font-semibold text-text">{data.subject}</span>
              </p>
            </div>
            <Button variant="ghost" onClick={() => setEditing((v) => !v)} className="h-8 shrink-0">
              {editing ? "Done editing" : "Edit text"}
            </Button>
          </div>

          <label className="flex flex-col gap-1 rounded-inner border border-border p-3">
            <span className="text-xs font-semibold text-text">
              Attach a coupon (optional)
            </span>
            <select
              className={field}
              value={coupon}
              onChange={(e) => setCoupon(e.target.value)}
            >
              <option value="">No coupon</option>
              {couponOptions.map((d) => (
                <option key={d.id} value={d.code as string}>
                  {d.code} —{" "}
                  {d.valueType === "PERCENTAGE"
                    ? `${Number(d.value)}% off`
                    : d.valueType === "FREE_SHIPPING"
                      ? "Free shipping"
                      : `৳${Number(d.value).toLocaleString()} off`}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-secondary">
              {couponOptions.length === 0
                ? "No published coupon codes yet — create one under Discounts."
                : "The code is shown in the email and added to the order button's link, so it applies itself when they arrive."}
            </span>
          </label>

          {editing && (
            <div className="flex flex-col gap-2 rounded-inner border border-border p-3">
              <p className="text-[11px] text-secondary">
                Changes apply to this email only. {"{{name}}"} and {"{{total}}"} are filled in
                automatically. To change the default for everyone, use Recovery → Settings.
              </p>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-text">Subject</span>
                <input
                  className={field}
                  value={draft.subject ?? ""}
                  onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-text">Heading</span>
                <input
                  className={field}
                  value={draft.heading ?? ""}
                  onChange={(e) => setDraft({ ...draft, heading: e.target.value })}
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-xs font-semibold text-text">Message</span>
                <textarea
                  rows={4}
                  className={field}
                  value={draft.message ?? ""}
                  onChange={(e) => setDraft({ ...draft, message: e.target.value })}
                />
              </label>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-text">Order button</span>
                  <input
                    className={field}
                    value={draft.ctaLabel ?? ""}
                    onChange={(e) => setDraft({ ...draft, ctaLabel: e.target.value })}
                  />
                </label>
                <label className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-text">WhatsApp button</span>
                  <input
                    className={field}
                    value={draft.whatsappLabel ?? ""}
                    onChange={(e) => setDraft({ ...draft, whatsappLabel: e.target.value })}
                  />
                </label>
              </div>
            </div>
          )}

          {/* Sandboxed: this is the real email body, and the admin is not the
              place to let its markup run anything. */}
          <iframe
            title="Email preview"
            sandbox=""
            srcDoc={data.html}
            className="h-[46vh] w-full rounded-sm border border-border bg-white"
          />

          {failure && <p className="text-xs text-danger">{failure}</p>}
          {sent && <p className="text-xs font-semibold text-success">✓ Sent to {data.to}</p>}

          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={!data.to || send.isPending || sent}>
              {send.isPending ? "Sending…" : sent ? "Sent" : "Send email"}
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}
