import { SeoMeta } from '@amader/db';

export interface SeoMetaDto {
  entityType: string;
  entityId: number;
  locale: string;
  title: string | null;
  description: string | null;
  canonicalUrl: string | null;
  robots: string;
  ogTitle: string | null;
  ogDescription: string | null;
  ogImageUrl: string | null;
  structuredDataType: string | null;
}

export function toSeoMetaDto(meta: SeoMeta): SeoMetaDto {
  return {
    entityType: meta.entityType,
    entityId: meta.entityId,
    locale: meta.locale,
    title: meta.title,
    description: meta.description,
    canonicalUrl: meta.canonicalUrl,
    robots: meta.robots,
    ogTitle: meta.ogTitle,
    ogDescription: meta.ogDescription,
    ogImageUrl: meta.ogImageUrl,
    structuredDataType: meta.structuredDataType,
  };
}

// What every public detail endpoint merges into its response (AGENTS.md §5/§9:
// "every public entity: stable slug + SeoMeta"). Always fully populated —
// resolve() fills gaps from the entity's own content, never returns nulls
// for title/description/canonical so the frontend never needs its own
// fallback logic.
export interface ResolvedSeoDto {
  title: string;
  description: string | null;
  canonicalUrl: string;
  robots: string;
  ogTitle: string;
  ogDescription: string | null;
  ogImageUrl: string | null;
}
