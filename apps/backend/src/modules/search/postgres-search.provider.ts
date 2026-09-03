import { Injectable } from '@nestjs/common';
import { Locale, Prisma } from '@amader/db';
import { PaginatedResult } from '@amader/shared';
import { PrismaService } from '../../common/prisma/prisma.service';
import { SynonymsService } from './synonyms.service';
import { SearchProvider } from './search-provider.interface';
import { ProductSearchHit } from './search.mapper';

interface MatchRow {
  id: number;
  score: number;
}

// word_similarity (not similarity) — it scores the query against the best-
// matching *word* inside the name, so a short query isn't diluted by the
// rest of a longer product name (AGENTS.md §6 "typo-tolerant").
const WORD_SIMILARITY_THRESHOLD = 0.3;

@Injectable()
export class PostgresSearchProvider implements SearchProvider {
  constructor(
    private readonly prisma: PrismaService,
    private readonly synonyms: SynonymsService,
  ) {}

  async searchProducts(
    query: string,
    locale: Locale,
    page: number,
    pageSize: number,
  ): Promise<PaginatedResult<ProductSearchHit>> {
    const terms = await this.synonyms.expand(query);

    const matchCondition = Prisma.join(
      terms.map(
        (t) =>
          Prisma.sql`(word_similarity(${t}, pt.name) > ${WORD_SIMILARITY_THRESHOLD} OR pt.name ILIKE ${'%' + t + '%'})`,
      ),
      ' OR ',
    );
    const scoreExpr = Prisma.join(
      terms.map((t) => Prisma.sql`word_similarity(${t}, pt.name)`),
      ', ',
    );

    const [countRows, matchRows] = await Promise.all([
      this.prisma.client.$queryRaw<{ count: bigint }[]>`
        SELECT COUNT(DISTINCT p.id) AS count
        FROM products p
        JOIN product_translations pt ON pt.product_id = p.id
        WHERE p.deleted_at IS NULL AND p.status = 'PUBLISHED' AND (${matchCondition})
      `,
      this.prisma.client.$queryRaw<MatchRow[]>`
        SELECT id, score FROM (
          SELECT DISTINCT ON (p.id) p.id AS id, GREATEST(${scoreExpr}) AS score
          FROM products p
          JOIN product_translations pt ON pt.product_id = p.id
          WHERE p.deleted_at IS NULL AND p.status = 'PUBLISHED' AND (${matchCondition})
          ORDER BY p.id, score DESC
        ) matched
        ORDER BY score DESC
        LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
      `,
    ]);

    const total = Number(countRows[0]?.count ?? 0);
    if (matchRows.length === 0) {
      return { items: [], total, page, pageSize };
    }

    const products = await this.prisma.client.product.findMany({
      where: { id: { in: matchRows.map((m) => m.id) } },
      include: {
        translations: true,
        media: {
          where: { isPrimary: true },
          include: { media: true },
          take: 1,
        },
        variants: {
          // Public surface #5 (see 20260903000000_variant_admin_only): search
          // results price off variants[0], so a cheap staff-only variant would
          // otherwise advertise a price customers cannot buy at.
          where: { isAdminOnly: false },
          // salePrice as well as price — a variant-only product carries
          // BOTH on the variant, never on the parent row, so selecting just
          // `price` meant those products could never show a sale price.
          select: { price: true, salePrice: true },
          orderBy: { price: 'asc' },
          take: 1,
        },
      },
    });
    const byId = new Map(products.map((p) => [p.id, p]));

    const items: ProductSearchHit[] = matchRows
      .map((m) => ({ match: m, product: byId.get(m.id) }))
      .filter(
        (x): x is { match: MatchRow; product: NonNullable<typeof x.product> } =>
          !!x.product,
      )
      .map(({ match, product: p }) => {
        const translation =
          p.translations.find((t) => t.locale === locale) ?? p.translations[0];
        // Variant-only products carry no price/salePrice on the parent row
        // — fall through to the cheapest variant for both, same precedence
        // apps/web's toProductCardData uses so search results and product
        // cards can't disagree about the same product.
        const price = p.price ?? p.variants[0]?.price ?? null;
        const rawSalePrice = p.salePrice ?? p.variants[0]?.salePrice ?? null;
        // Sale start/end are product-level (variants have no window of their
        // own). Without this check an expired — or not-yet-started — sale
        // price was shown in search while the PDP correctly charged full
        // price; the pricing service enforces the same window server-side.
        const now = Date.now();
        const inSaleWindow =
          (!p.saleStartsAt || p.saleStartsAt.getTime() <= now) &&
          (!p.saleEndsAt || p.saleEndsAt.getTime() >= now);
        const onSale =
          rawSalePrice !== null &&
          price !== null &&
          rawSalePrice.lessThan(price) &&
          inSaleWindow;
        return {
          id: p.id,
          slug: p.slug,
          name: translation?.name ?? p.slug,
          price: price ? price.toString() : null,
          salePrice: onSale ? rawSalePrice.toString() : null,
          primaryImageUrl: p.media[0]?.media.url ?? null,
          score: match.score,
        };
      });

    return { items, total, page, pageSize };
  }
}
