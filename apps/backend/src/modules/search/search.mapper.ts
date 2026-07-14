// Split out of search-provider.interface.ts on purpose: the @nestjs/swagger
// CLI plugin only reflects property types from files matching nest-cli.json's
// dtoFileNameSuffix (*.dto.ts/*.entity.ts/*.mapper.ts) — a class living in
// *.interface.ts silently generates as `Record<string, never>` in the
// OpenAPI schema (and therefore in the frontend's generated types) with no
// build-time warning. Same bug class as the *.mapper.ts suffix gap fixed
// during F1 of the frontend phase.
export class ProductSearchHit {
  id!: number;
  slug!: string;
  name!: string;
  price!: string | null;
  salePrice!: string | null;
  primaryImageUrl!: string | null;
  score!: number;
}
