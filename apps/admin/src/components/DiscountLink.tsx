"use client";

import { useState } from "react";
import { Icon } from "@amader/admin-ui";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";

/**
 * The shareable link for a coupon: opening it applies the code automatically
 * (the storefront's CouponFromLink remembers it and applies it once the cart
 * has items, so the customer can shop first). The server still enforces every
 * rule — usage limits, dates, minimum order — so the link grants nothing the
 * code itself would not.
 */
export function useDiscountLink(
  code: string | null | undefined,
): string | null {
  const base = useStorefrontUrl();
  return code ? `${base}/?coupon=${encodeURIComponent(code)}` : null;
}

async function copy(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false; // Non-secure origin or permission denied — the link is still shown to copy by hand.
  }
}

/** Icon-only copy button for table rows. */
export function CopyDiscountLinkButton({ code }: { code: string | null }) {
  const link = useDiscountLink(code);
  const [done, setDone] = useState(false);
  if (!link) return null;
  return (
    <button
      type="button"
      aria-label="Copy discount link"
      title={done ? "Copied!" : `Copy link: ${link}`}
      onClick={async () => {
        if (await copy(link)) {
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } else window.prompt("Copy this link", link);
      }}
      className="text-brand-500 hover:opacity-70"
    >
      <Icon name={done ? "check" : "link"} size={18} />
    </button>
  );
}

/** The full link with a Copy button, for the discount's edit page. */
export function DiscountLinkField({
  code,
  status,
  maxUsesTotal,
}: {
  code: string | null;
  status: string;
  maxUsesTotal: number | null;
}) {
  const link = useDiscountLink(code);
  const [done, setDone] = useState(false);
  if (!link) return null;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-xs font-semibold text-secondary">Share link</span>
      <div className="flex gap-2">
        <input
          readOnly
          value={link}
          onFocus={(e) => e.target.select()}
          className="h-10 min-w-0 flex-1 rounded-sm border border-border bg-surface-2 px-3 text-sm text-text outline-none"
        />
        <button
          type="button"
          onClick={async () => {
            if (await copy(link)) {
              setDone(true);
              setTimeout(() => setDone(false), 1500);
            }
          }}
          className="inline-flex h-10 items-center gap-1.5 rounded-sm border border-border px-3 text-sm font-semibold text-brand-500"
        >
          <Icon name={done ? "check" : "content_copy"} size={16} />
          {done ? "Copied" : "Copy"}
        </button>
      </div>
      <p className="text-xs text-muted">
        Send this to a customer. Opening it applies the discount automatically
        at checkout.{" "}
        {maxUsesTotal
          ? `It works ${maxUsesTotal} time${maxUsesTotal === 1 ? "" : "s"} in total.`
          : "No total limit is set — anyone with the link can use it until it ends."}
      </p>
      {status !== "PUBLISHED" && (
        <p className="text-xs font-semibold text-danger">
          This discount is not Published, so the link won&apos;t apply anything
          yet.
        </p>
      )}
    </div>
  );
}
