// Blog content is admin-authored WYSIWYG HTML, not arbitrary/untrusted markup.
// ponytail: regex-based heading/tag handling, not a full HTML parser — good
// enough for well-formed editor output; add a real parser (e.g. cheerio) if
// malformed HTML ever needs to survive this.

export function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface TocEntry {
  level: number;
  text: string;
  anchor: string;
}

function slugifyHeading(text: string, seen: Map<string, number>): string {
  const base =
    text
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-') || 'section';
  const count = seen.get(base) ?? 0;
  seen.set(base, count + 1);
  return count === 0 ? base : `${base}-${count}`;
}

// Injects an id="..." into each <h2>/<h3> so the returned TOC's anchors
// actually resolve to something, and returns both together.
export function extractToc(html: string): { content: string; toc: TocEntry[] } {
  const seen = new Map<string, number>();
  const toc: TocEntry[] = [];

  const content = html.replace(
    /<h([23])((?:(?!>)[^])*)>([\s\S]*?)<\/h\1>/gi,
    (match, level: string, attrs: string, inner: string) => {
      const text = stripHtml(inner);
      if (!text) return match;

      const existingId = /\bid=["']([^"']+)["']/.exec(attrs);
      const anchor = existingId ? existingId[1] : slugifyHeading(text, seen);
      toc.push({ level: Number(level), text, anchor });

      if (existingId) return match;
      return `<h${level}${attrs} id="${anchor}">${inner}</h${level}>`;
    },
  );

  return { content, toc };
}

export interface SeoScoreInput {
  title: string;
  excerpt?: string | null;
  metaDescription?: string | null;
  content: string;
}

// On-page SEO heuristic (AGENTS.md §6, "per-article SEO score"), cached on
// BlogPostTranslation.seoScore and recomputed whenever a translation is
// written — not derived at read time. 0-100, weighted toward the checks an
// editor can actually act on.
export function computeSeoScore(input: SeoScoreInput): number {
  let score = 0;
  const titleLen = input.title.trim().length;
  if (titleLen >= 30 && titleLen <= 70) score += 15;

  const metaLen = (input.metaDescription ?? '').trim().length;
  if (metaLen >= 50 && metaLen <= 160) score += 20;

  if ((input.excerpt ?? '').trim().length > 0) score += 15;

  const wordCount = stripHtml(input.content)
    .split(/\s+/)
    .filter(Boolean).length;
  if (wordCount >= 300) score += 20;

  if (/<h2[\s>]/i.test(input.content)) score += 15;
  if (/<a\s[^>]*href=/i.test(input.content)) score += 15;

  return Math.min(score, 100);
}
