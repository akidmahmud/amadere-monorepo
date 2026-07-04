// Internal-link suggestion heuristic (AGENTS.md §6, flagged critical for SEO).
// ponytail: substring matching against candidate titles, not NLP/keyword
// extraction — cheap, explainable, and good enough to point an editor at
// real opportunities; upgrade to stemming/fuzzy matching if editors report
// it missing obvious matches.

export interface LinkCandidate {
  type: 'post' | 'product';
  title: string;
  url: string;
}

export interface LinkSuggestion extends LinkCandidate {
  occurrences: number;
}

const MAX_SUGGESTIONS = 10;

export function suggestInternalLinks(
  content: string,
  candidates: LinkCandidate[],
): LinkSuggestion[] {
  const plainText = content.replace(/<[^>]*>/g, ' ');
  const suggestions: LinkSuggestion[] = [];

  for (const candidate of candidates) {
    const title = candidate.title.trim();
    if (title.length < 3) continue;

    // Already linked somewhere in this content? Don't suggest it again.
    const hrefPattern = new RegExp(
      `href=["'][^"']*${escapeRegExp(candidate.url)}`,
      'i',
    );
    if (hrefPattern.test(content)) continue;

    const occurrences = countOccurrences(plainText, title);
    if (occurrences > 0) {
      suggestions.push({ ...candidate, occurrences });
    }
  }

  return suggestions
    .sort((a, b) => b.occurrences - a.occurrences)
    .slice(0, MAX_SUGGESTIONS);
}

function countOccurrences(haystack: string, needle: string): number {
  const pattern = new RegExp(escapeRegExp(needle), 'gi');
  return (haystack.match(pattern) ?? []).length;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
