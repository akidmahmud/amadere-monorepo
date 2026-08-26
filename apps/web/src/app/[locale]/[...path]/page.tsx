import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getLanguageAlternates } from "@/i18n/alternates";
import { api, ApiError } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { redirectIfMapped } from "@/lib/redirects";
import { sanitizeHtml } from "@/lib/sanitize-html";
import {
  isRenderableDocument,
  documentUsesCheckoutBlocks,
} from "@amader/page-builder/validate";
import { PageBuilderRender } from "@/components/PageBuilderRender";
import { CheckoutOnPage } from "@/components/checkout/CheckoutOnPage";
import type { components } from "@/lib/api/schema";

// The last-resort route at this segment level — Next.js always prefers a
// real static/dynamic sibling folder (products/, blog/, checkout/, ...) over
// this catch-all, so anything landing here genuinely matched nothing else.
// Two distinct reasons a path ends up here:
//  1. A single-segment static CMS page (About, FAQs, Terms, ...) or a bare
//     old-style blog-post slug (`/{slug}`, 160 of 204 migrated posts).
//  2. An old Botble-era URL shape with no current equivalent folder at all
//     (`/product/{slug}`, `/product-categorie/{slug}`, `/brand/{slug}`,
//     `/product-tag/{slug}`, `/tag/{slug}`) — these can only ever be resolved
//     via the redirect table, never a real page.

// ISR per §7 (on-demand revalidation still needs the backend side — §14).
export const revalidate = 3600;

// Deliberately empty — no paths are pre-rendered at build time, but
// exporting this at all is what makes Next.js treat the segment as
// ISR-eligible-on-first-hit rather than fully dynamic (same fix as
// products/[slug] and blog/[slug] — see PERF-BRIEF.md §3 and
// product-detail.tsx's comment on this exact gotcha; without it,
// `revalidate` above was silently ignored and every CMS page / legacy-URL
// redirect through this catch-all was a full SSR pass on every request).
// `dynamicParams` defaults to true, so any path is still rendered on demand
// and then cached per `revalidate` above.
export async function generateStaticParams() {
  return [];
}

async function getStaticPage(slug: string, locale: "EN" | "BN") {
  try {
    const res = await api.GET("/api/v1/pages/{slug}", {
      params: { path: { slug }, query: { locale } },
    });
    return res.data as components["schemas"]["PublicPageDetailDto"] | undefined;
  } catch (err) {
    // A real "no such page" — the backend's own 404 for this slug. Safe to
    // treat as not-found and let ISR (revalidate = 3600 below) cache that.
    if (err instanceof ApiError && err.status === 404) return undefined;
    // Anything else (network blip, backend 5xx, DB timeout) must NOT be
    // swallowed into "not found" the way the shared safeGet() helper does —
    // this route's 1-hour ISR cache would then bake a single transient
    // hiccup into a false 404 for up to an hour, which is exactly the
    // "works, then randomly 404s, then works again" behavior reported live
    // on amadere.com's footer links. Re-throwing instead means Next.js
    // keeps serving the last known-good cached page (if any) and retries
    // fresh on the next request rather than caching the failure.
    throw err;
  }
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; path: string[] }>;
}): Promise<Metadata> {
  const { locale, path } = await params;
  const fullPath = `/${path.join("/")}`;

  if (path.length === 1) {
    const page = await getStaticPage(path[0], toApiLocale(locale));
    if (page) {
      return {
        title: page.seo.title,
        description: page.seo.description ?? undefined,
        alternates: { canonical: fullPath, languages: getLanguageAlternates(fullPath) },
      };
    }
  }

  await redirectIfMapped(fullPath, locale);
  notFound();
}

export default async function CatchAllPage({
  params,
}: {
  params: Promise<{ locale: string; path: string[] }>;
}) {
  const { locale, path } = await params;
  setRequestLocale(locale);
  const fullPath = `/${path.join("/")}`;

  const slug = path.length === 1 ? path[0] : path[0] === "pages" && path.length === 2 ? path[1] : null;

  if (slug) {
    const page = await getStaticPage(slug, toApiLocale(locale));
    if (page) {
      // Rendering precedence (plan §5.1): a valid builder layout wins, and
      // anything else falls through to the legacy HTML below completely
      // untouched. That fallback is what makes this change zero-risk for the
      // pages that already exist -- every one of them has layout = null.
      //
      // Validity is checked HERE, not inside PageBuilderRender: a document
      // that went stale after publish (a block removed in a later deploy)
      // must fall through to the legacy HTML below, and a component that
      // rendered nothing would give a blank page instead.
      //
      // The heading is deliberately NOT rendered around a builder layout: a
      // built page owns its own composition, and forcing an <h1> above it
      // would give the owner a title they cannot move or remove.
      if (page.layout && isRenderableDocument(page.layout, "CONTENT")) {
        const rendered = <PageBuilderRender data={page.layout} />;
        // A page carrying checkout blocks gets the checkout brain mounted
        // around it, so the form on a landing page is the real one -- same
        // validation, fraud preflight, COD OTP and order mutation as
        // /checkout. Pages without checkout blocks skip it entirely: the
        // provider fetches cart and payment config, which an About page has no
        // business paying for.
        return (
          <main className="flex-1">
            {documentUsesCheckoutBlocks(page.layout) ? (
              <CheckoutOnPage>{rendered}</CheckoutOnPage>
            ) : (
              rendered
            )}
          </main>
        );
      }
      return (
        <main className="flex-1">
          <div className="mx-auto max-w-4xl px-5 py-12">
            <h1 className="mb-6 font-serif text-3xl font-bold text-ink">{page.title}</h1>
            {/* Admin-authored WYSIWYG HTML, not user-generated — still sanitized before render */}
            {/* eslint-disable-next-line react/no-danger */}
            <div
              className="prose max-w-none font-body text-sm leading-relaxed text-ink [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-green [&_a]:underline"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }}
            />
          </div>
        </main>
      );
    }
  }

  await redirectIfMapped(fullPath, locale);
  notFound();
}
