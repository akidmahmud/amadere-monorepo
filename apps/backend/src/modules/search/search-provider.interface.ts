import { Locale } from '@amader/db';
import { PaginatedResult } from '@amader/shared';

export const SEARCH_PROVIDER = Symbol('SEARCH_PROVIDER');

export class ProductSearchHit {
  id!: number;
  slug!: string;
  name!: string;
  price!: string | null;
  salePrice!: string | null;
  primaryImageUrl!: string | null;
  score!: number;
}

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
