import type { Metadata } from "next";
import { setRequestLocale } from "next-intl/server";
import { isRenderableDocument } from "@amader/page-builder/validate";
import { CheckoutProvider } from "@/components/checkout/CheckoutProvider";
import { CheckoutLayoutRenderer } from "@/components/checkout/CheckoutLayoutRenderer";
import { getLanguageAlternates } from "@/i18n/alternates";
import { api } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";

/**
 * The published checkout layout, or null. NEVER throws (plan §9.2): checkout
 * must not depend on a successful network call to render, so any failure here
 * degrades to the hardcoded layout rather than taking the page down.
 */
async function getActiveCheckoutLayout(locale: "EN" | "BN"): Promise<unknown | null> {
  try {
    const res = await api.GET("/api/v1/pages/checkout-layout", {
      params: { query: { locale } },
    });
    const layout = (res.data as { layout?: unknown } | undefined)?.layout ?? null;
    // Validated before it is handed to the renderer as well as at publish
    // time. A layout can go stale between the two -- a block removed in a
    // later deploy -- and the customer must not be the one who finds out.
    return layout && isRenderableDocument(layout, "CHECKOUT") ? layout : null;
  } catch {
    return null;
  }
}

export function generateMetadata(): Metadata {
  return {
    title: "Checkout",
    robots: { index: false, follow: false },
    alternates: { canonical: "/checkout", languages: getLanguageAlternates("/checkout") },
  };
}

export default async function CheckoutPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);

  const layout = await getActiveCheckoutLayout(toApiLocale(locale));

  return (
    // data-checkout drives the CSS in globals.css that hides the site footer
    // on phones for this route only — see the rule there for why.
    <main className="flex-1" data-checkout>
      {/* The provider owns the form and the brain either way; only the
          arrangement differs. Passing no children makes it render
          DefaultCheckoutLayout, which is the fallback for: no published
          layout, a failed fetch, and a layout that fails validation. */}
      <CheckoutProvider>
        {layout ? <CheckoutLayoutRenderer layout={layout} /> : undefined}
      </CheckoutProvider>
    </main>
  );
}
