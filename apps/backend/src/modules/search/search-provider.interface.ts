import { Locale } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { ProductSearchHit } from './search.mapper';

export const SEARCH_PROVIDER = Symbol('SEARCH_PROVIDER');

// Behind an interface so the engine can be swapped (Postgres now,
// Meilisearch/Typesense later) without touching callers (AGENTS.md §6).
export interface SearchProvider {
  searchProducts(
    query: string,
    locale: Locale,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<ProductSearchHit>>;
}
