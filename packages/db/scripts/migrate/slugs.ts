import type { Connection } from 'mysql2/promise';

export interface LegacySlug {
  slug: string;
  prefix: string;
}

// A handful of entities (Brand, ProductTag, blog Category/Tag/Post, Page)
// have no slug column of their own in the old schema — their slug only
// exists in the polymorphic `slugs` table. Products and ProductCategory
// carry their own `slug` column directly and don't need this.
export async function loadSlugMap(
  conn: Connection,
  referenceType: string,
): Promise<Map<number, LegacySlug>> {
  const [rows] = await conn.query<any[]>(
    'SELECT reference_id, `key`, prefix FROM slugs WHERE reference_type = ?',
    [referenceType],
  );
  const map = new Map<number, LegacySlug>();
  for (const row of rows as any[]) {
    map.set(row.reference_id, { slug: row.key, prefix: row.prefix ?? '' });
  }
  return map;
}

// The exact old path this entity was served at, e.g. "/product/gawa-ghee" or
// "/gawa-ghee" for a bare (no-prefix) slug — the fromPath half of every
// Redirect row.
export function oldPath(entry: LegacySlug | undefined, fallbackSlug: string): string {
  const slug = entry?.slug ?? fallbackSlug;
  const prefix = entry?.prefix ?? '';
  return prefix ? `/${prefix}/${slug}` : `/${slug}`;
}
