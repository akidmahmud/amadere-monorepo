import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { isRenderableDocument } from "@amader/page-builder/validate";
import { PageBuilderRender } from "@/components/PageBuilderRender";
import { sanitizeHtml } from "@/lib/sanitize-html";
import { api } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import type { components } from "@/lib/api/schema";

/**
 * Draft preview for a builder page (plan §9.3).
 *
 * Mirrors the existing blog and product preview routes rather than introducing
 * Next.js draft mode: the same short-lived, page-scoped token the rest of this
 * codebase already uses, and no cookie state to leak between tabs.
 *
 * `force-dynamic` and `noindex` are both load-bearing. An unpublished layout
 * must never be cached at the edge or reachable from search — that is the
 * whole risk §6.3 warns about.
 */
export const dynamic = "force-dynamic";

export const metadata = { robots: { index: false, follow: false } };

export default async function PagePreview({
  params,
}: {
  params: Promise<{ locale: string; slug: string; token: string }>;
}) {
  const { locale, slug, token } = await params;
  setRequestLocale(locale);

  const res = await api.GET("/api/v1/pages/{slug}", {
    params: {
      path: { slug },
      query: { locale: toApiLocale(locale), previewToken: token },
    },
  });
  const page = res.data as
    | components["schemas"]["PublicPageDetailDto"]
    | undefined;
  if (!page) notFound();

  return (
    <main className="flex-1">
      <div className="bg-gold px-4 py-2 text-center font-ui text-sm font-semibold text-ink">
        Draft preview — not visible to customers
      </div>
      {page.layout && isRenderableDocument(page.layout, "CONTENT") ? (
        <PageBuilderRender data={page.layout} />
      ) : (
        <div className="mx-auto max-w-4xl px-5 py-12">
          <h1 className="mb-6 font-serif text-3xl font-bold text-ink">
            {page.title}
          </h1>
          <div
            className="prose max-w-none font-body text-sm leading-relaxed text-ink"
            dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }}
          />
        </div>
      )}
    </main>
  );
}
