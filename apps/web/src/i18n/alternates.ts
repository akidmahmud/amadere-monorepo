import { getPathname } from "./navigation";
import { routing } from "./routing";

/**
 * Builds the `alternates.languages` map for `generateMetadata` — every public
 * page should pass its own pathname through this so hreflang covers EN/BN
 * without duplicating the locale list per page (AGENTS.web.md §8).
 */
export function getLanguageAlternates(href: string): Record<string, string> {
  return Object.fromEntries(
    routing.locales.map((locale) => [locale, getPathname({ href, locale })]),
  );
}
