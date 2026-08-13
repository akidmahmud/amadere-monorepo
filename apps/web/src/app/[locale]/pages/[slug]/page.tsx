import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import { redirectIfMapped } from "@/lib/redirects";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { components } from "@/lib/api/schema";

export const revalidate = 3600;

async function getStaticPage(slug: string, locale: string) {
  const res = await safeGet("/api/v1/pages/{slug}", {
    params: { path: { slug }, query: { locale } },
  });
  return res.data as components["schemas"]["PublicPageDetailDto"] | undefined;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}): Promise<Metadata> {
  const { locale, slug } = await params;
  const fullPath = `/pages/${slug}`;

  const page = await getStaticPage(slug, toApiLocale(locale));
  if (page) {
    return {
      title: page.seo.title,
      description: page.seo.description ?? undefined,
      alternates: { canonical: fullPath, languages: getLanguageAlternates(fullPath) },
    };
  }

  await redirectIfMapped(fullPath, locale);
  notFound();
}

export default async function CMSPage({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  setRequestLocale(locale);
  const fullPath = `/pages/${slug}`;

  const page = await getStaticPage(slug, toApiLocale(locale));
  if (!page) {
    await redirectIfMapped(fullPath, locale);
    notFound();
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-4xl px-5 py-12">
        <h1 className="mb-6 font-serif text-3xl font-bold text-ink">{page.title}</h1>
        {/* Admin-authored WYSIWYG HTML sanitized before render */}
        <div
          className="prose max-w-none font-body text-sm leading-relaxed text-ink [&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold [&_h2]:mt-8 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-semibold [&_p]:mb-4 [&_ul]:mb-4 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-4 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-green [&_a]:underline"
          dangerouslySetInnerHTML={{ __html: sanitizeHtml(page.content) }}
        />
      </div>
    </main>
  );
}
