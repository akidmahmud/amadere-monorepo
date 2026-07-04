import type { Connection } from 'mysql2/promise';
import type { PrismaClient } from '../../src/index';
import { Prisma } from '../../src/index';
import { loadSlugMap, oldPath } from './slugs';
import { bump, type MigrationReport } from './report';

const Decimal = Prisma.Decimal;

function slugify(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-') || `item-${Date.now()}`
  );
}

function mapStatus(legacyStatus: string): 'DRAFT' | 'PUBLISHED' {
  return legacyStatus === 'published' ? 'PUBLISHED' : 'DRAFT';
}

// Media re-upload to R2 is a deliberate follow-up (no real credentials yet
// — confirmed with the user). This placeholder scheme makes every
// not-yet-uploaded reference trivially findable later.
function legacyMediaUrl(path: string): string {
  return `legacy://${path}`;
}

export interface VariantRef {
  productId: number;
  variantId: number;
}

export interface ProductMigrationResult {
  // Legacy is_variation=0 product id -> new Product id.
  productId: Map<number, number>;
  // Legacy is_variation=1 product id -> new {productId, variantId}. Real
  // order data overwhelmingly references variant rows directly (Botble
  // models each SKU combination as its own product row) — orders.ts needs
  // both maps to resolve ec_order_product.product_id correctly.
  variantRef: Map<number, VariantRef>;
}

export async function migrateBrands(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
): Promise<Map<number, number>> {
  const [rows] = await source.query<any[]>('SELECT * FROM ec_brands');
  const slugs = await loadSlugMap(source, 'Botble\\Ecommerce\\Models\\Brand');
  const idMap = new Map<number, number>();
  bump(report, 'brands', 'source', rows.length);

  for (const row of rows) {
    const legacy = slugs.get(row.id);
    const slug = legacy?.slug ?? slugify(row.name);
    const brand = await prisma.brand.upsert({
      where: { legacyId: row.id },
      create: {
        legacyId: row.id,
        slug,
        legacySlug: oldPath(legacy, slug),
        logoUrl: row.logo ? legacyMediaUrl(row.logo) : null,
        websiteUrl: row.website,
        isFeatured: !!row.is_featured,
        sortOrder: row.order ?? 0,
        status: mapStatus(row.status),
        translations: {
          create: [
            { locale: 'EN', name: row.name, description: row.description },
            { locale: 'BN', name: row.name, description: row.description },
          ],
        },
      },
      update: {
        slug,
        logoUrl: row.logo ? legacyMediaUrl(row.logo) : null,
        websiteUrl: row.website,
        isFeatured: !!row.is_featured,
        sortOrder: row.order ?? 0,
        status: mapStatus(row.status),
      },
    });
    idMap.set(row.id, brand.id);
    bump(report, 'brands', 'migrated');
  }
  return idMap;
}

export async function migrateCategories(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
): Promise<Map<number, number>> {
  const [rows] = await source.query<any[]>('SELECT * FROM ec_product_categories');
  const idMap = new Map<number, number>();
  bump(report, 'categories', 'source', rows.length);

  // Pass 1: create/update every row with parentId left null.
  for (const row of rows) {
    const category = await prisma.category.upsert({
      where: { legacyId: row.id },
      create: {
        legacyId: row.id,
        slug: row.slug ?? slugify(row.name),
        legacySlug: `/product-categorie/${row.slug ?? slugify(row.name)}`,
        imageUrl: row.image ? legacyMediaUrl(row.image) : null,
        isFeatured: !!row.is_featured,
        sortOrder: row.order ?? 0,
        status: mapStatus(row.status),
        translations: {
          create: [
            { locale: 'EN', name: row.name, description: row.description },
            { locale: 'BN', name: row.name, description: row.description },
          ],
        },
      },
      update: {
        slug: row.slug ?? slugify(row.name),
        imageUrl: row.image ? legacyMediaUrl(row.image) : null,
        isFeatured: !!row.is_featured,
        sortOrder: row.order ?? 0,
        status: mapStatus(row.status),
      },
    });
    idMap.set(row.id, category.id);
    bump(report, 'categories', 'migrated');
  }

  // Pass 2: wire up parents now that every legacy id has a new id.
  for (const row of rows) {
    if (row.parent_id && idMap.has(row.parent_id)) {
      await prisma.category.update({
        where: { id: idMap.get(row.id)! },
        data: { parentId: idMap.get(row.parent_id)! },
      });
    }
  }

  return idMap;
}

export async function migrateProductTags(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
): Promise<Map<number, number>> {
  const [rows] = await source.query<any[]>('SELECT * FROM ec_product_tags');
  const slugs = await loadSlugMap(source, 'Botble\\Ecommerce\\Models\\ProductTag');
  const idMap = new Map<number, number>();
  bump(report, 'product_tags', 'source', rows.length);

  for (const row of rows) {
    const legacy = slugs.get(row.id);
    const slug = legacy?.slug ?? slugify(row.name);
    const tag = await prisma.tag.upsert({
      where: { legacyId: row.id },
      create: {
        legacyId: row.id,
        slug,
        legacySlug: oldPath(legacy, slug),
        status: mapStatus(row.status),
        translations: {
          create: [
            { locale: 'EN', name: row.name, description: row.description },
            { locale: 'BN', name: row.name, description: row.description },
          ],
        },
      },
      update: { slug, status: mapStatus(row.status) },
    });
    idMap.set(row.id, tag.id);
    bump(report, 'product_tags', 'migrated');
  }
  return idMap;
}

export async function migrateAttributes(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
): Promise<{ attributeId: Map<number, number>; attributeValueId: Map<number, number> }> {
  const [sets] = await source.query<any[]>('SELECT * FROM ec_product_attribute_sets');
  const attributeId = new Map<number, number>();
  bump(report, 'attributes', 'source', sets.length);

  for (const row of sets) {
    const existing = await prisma.attribute.findUnique({ where: { slug: row.slug ?? slugify(row.title) } });
    const attribute =
      existing ??
      (await prisma.attribute.create({
        data: {
          slug: row.slug ?? slugify(row.title),
          sortOrder: row.order ?? 0,
          translations: {
            create: [
              { locale: 'EN', name: row.title },
              { locale: 'BN', name: row.title },
            ],
          },
        },
      }));
    attributeId.set(row.id, attribute.id);
    bump(report, 'attributes', 'migrated');
  }

  const [values] = await source.query<any[]>('SELECT * FROM ec_product_attributes');
  const attributeValueId = new Map<number, number>();
  bump(report, 'attribute_values', 'source', values.length);

  for (const row of values) {
    const newAttributeId = attributeId.get(row.attribute_set_id);
    if (!newAttributeId) continue;

    const existingTranslation = await prisma.attributeValueTranslation.findFirst({
      where: { locale: 'EN', value: row.title, attributeValue: { attributeId: newAttributeId } },
    });
    const value =
      existingTranslation != null
        ? { id: existingTranslation.attributeValueId }
        : await prisma.attributeValue.create({
            data: {
              attributeId: newAttributeId,
              colorHex: row.color || null,
              imageUrl: row.image ? legacyMediaUrl(row.image) : null,
              sortOrder: row.order ?? 0,
              translations: {
                create: [
                  { locale: 'EN', value: row.title },
                  { locale: 'BN', value: row.title },
                ],
              },
            },
          });
    attributeValueId.set(row.id, value.id);
    bump(report, 'attribute_values', 'migrated');
  }

  return { attributeId, attributeValueId };
}

async function upsertMedia(prisma: PrismaClient, relativePath: string): Promise<number> {
  const url = legacyMediaUrl(relativePath);
  const existing = await prisma.media.findFirst({ where: { url } });
  if (existing) return existing.id;
  const media = await prisma.media.create({ data: { url, type: 'IMAGE' } });
  return media.id;
}

export async function migrateProducts(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
  brandId: Map<number, number>,
  categoryId: Map<number, number>,
  tagId: Map<number, number>,
  attributeValueId: Map<number, number>,
): Promise<ProductMigrationResult> {
  const [parents] = await source.query<any[]>('SELECT * FROM ec_products WHERE is_variation = 0');
  const [variantRows] = await source.query<any[]>('SELECT * FROM ec_products WHERE is_variation = 1');
  const [variations] = await source.query<any[]>('SELECT * FROM ec_product_variations');
  const [variationItems] = await source.query<any[]>('SELECT * FROM ec_product_variation_items');
  const [categoryLinks] = await source.query<any[]>('SELECT * FROM ec_product_category_product');
  const [tagLinks] = await source.query<any[]>('SELECT * FROM ec_product_tag_product');

  const variantsByParent = new Map<number, any[]>();
  for (const v of variations) {
    const list = variantsByParent.get(v.configurable_product_id) ?? [];
    list.push(v);
    variantsByParent.set(v.configurable_product_id, list);
  }
  const variantRowById = new Map<number, any>(variantRows.map((r) => [r.id, r]));
  const attributeIdsByVariationId = new Map<number, number[]>();
  for (const item of variationItems) {
    const list = attributeIdsByVariationId.get(item.variation_id) ?? [];
    list.push(item.attribute_id);
    attributeIdsByVariationId.set(item.variation_id, list);
  }

  const productIdMap = new Map<number, number>();
  const variantRefMap = new Map<number, VariantRef>();
  bump(report, 'products', 'source', parents.length);
  report.notes.push(
    `Product.shippableWeight/ProductVariant.weightOverride carry the legacy` +
      ` "weight" column value as-is (assumed kilograms) — the old system's unit` +
      ` was never fully confirmed (AGENTS.md §11 open item). Spot-check a few` +
      ` real products against the live site before trusting courier-charge math.`,
  );

  for (const row of parents) {
    const legacyVariations = variantsByParent.get(row.id) ?? [];
    const hasVariants = legacyVariations.length > 0;

    const images: string[] = (() => {
      try {
        return row.images ? (JSON.parse(row.images) as string[]) : [];
      } catch {
        return row.image ? [row.image] : [];
      }
    })();
    if (images.length === 0 && row.image) images.push(row.image);

    const product = await prisma.product.upsert({
      where: { legacyId: row.id },
      create: {
        legacyId: row.id,
        slug: row.slug ?? slugify(row.name),
        legacySlug: `/product/${row.slug ?? slugify(row.name)}`,
        sku: row.sku || null,
        brandId: row.brand_id ? (brandId.get(row.brand_id) ?? null) : null,
        productType: 'PHYSICAL',
        status: mapStatus(row.status),
        isFeatured: !!row.is_featured,
        videoUrl: null,
        hasVariants,
        trackInventory: !!row.with_storehouse_management,
        allowBackorder: !!row.allow_checkout_when_out_of_stock,
        stock: hasVariants ? 0 : (row.quantity ?? 0),
        stockStatus: row.stock_status === 'out_of_stock' ? 'OUT_OF_STOCK' : 'IN_STOCK',
        price: hasVariants ? null : new Decimal(row.price ?? 0),
        salePrice: !hasVariants && row.sale_price ? new Decimal(row.sale_price) : null,
        saleStartsAt: row.start_date,
        saleEndsAt: row.end_date,
        costPerItem: row.cost_per_item ? new Decimal(row.cost_per_item) : null,
        shippableWeight: row.weight ? new Decimal(row.weight) : null,
        minOrderQuantity: row.minimum_order_quantity || 1,
        maxOrderQuantity: row.maximum_order_quantity || null,
        translations: {
          create: [
            {
              locale: 'EN',
              name: row.name,
              description: row.description,
              content: row.content,
            },
            {
              locale: 'BN',
              name: row.name,
              description: row.description,
              content: row.content,
            },
          ],
        },
      },
      update: {
        slug: row.slug ?? slugify(row.name),
        status: mapStatus(row.status),
        isFeatured: !!row.is_featured,
        hasVariants,
        stock: hasVariants ? 0 : (row.quantity ?? 0),
        price: hasVariants ? null : new Decimal(row.price ?? 0),
        salePrice: !hasVariants && row.sale_price ? new Decimal(row.sale_price) : null,
      },
    });
    productIdMap.set(row.id, product.id);
    bump(report, 'products', 'migrated');

    // Media
    for (const [index, path] of images.entries()) {
      const mediaId = await upsertMedia(prisma, path);
      await prisma.productMedia.upsert({
        where: { productId_mediaId: { productId: product.id, mediaId } },
        create: { productId: product.id, mediaId, sortOrder: index, isPrimary: index === 0 },
        update: {},
      });
    }

    // Categories / Tags
    const myCategoryLinks = categoryLinks.filter((l) => l.product_id === row.id);
    for (const link of myCategoryLinks) {
      const newCategoryId = categoryId.get(link.category_id);
      if (!newCategoryId) continue;
      await prisma.productCategory.upsert({
        where: { productId_categoryId: { productId: product.id, categoryId: newCategoryId } },
        create: { productId: product.id, categoryId: newCategoryId },
        update: {},
      });
    }
    const myTagLinks = tagLinks.filter((l) => l.product_id === row.id);
    for (const link of myTagLinks) {
      const newTagId = tagId.get(link.tag_id);
      if (!newTagId) continue;
      await prisma.productTag.upsert({
        where: { productId_tagId: { productId: product.id, tagId: newTagId } },
        create: { productId: product.id, tagId: newTagId },
        update: {},
      });
    }

    // Variants: recreated wholesale each run (cheap, static catalog data —
    // simpler and equally correct vs. inventing a variant-level natural key).
    if (hasVariants) {
      await prisma.productVariant.deleteMany({ where: { productId: product.id } });
      const attributeIdsUsed = new Set<number>();

      for (const variation of legacyVariations) {
        const variantRow = variantRowById.get(variation.product_id);
        if (!variantRow) continue;
        const itemAttributeIds = attributeIdsByVariationId.get(variation.id) ?? [];

        const variant = await prisma.productVariant.create({
          data: {
            productId: product.id,
            sku: variantRow.sku || null,
            barcode: variantRow.barcode || null,
            price: new Decimal(variantRow.price ?? 0),
            salePrice: variantRow.sale_price ? new Decimal(variantRow.sale_price) : null,
            stock: variantRow.quantity ?? 0,
            stockStatus: variantRow.stock_status === 'out_of_stock' ? 'OUT_OF_STOCK' : 'IN_STOCK',
            weightOverride: variantRow.weight ? new Decimal(variantRow.weight) : null,
            isDefault: !!variation.is_default,
          },
        });
        // Real order history overwhelmingly references the variant's own
        // legacy product row id directly (ec_order_product.product_id), not
        // the parent — orders.ts resolves against this map.
        variantRefMap.set(variantRow.id, { productId: product.id, variantId: variant.id });

        for (const legacyAttrId of itemAttributeIds) {
          const newValueId = attributeValueId.get(legacyAttrId);
          if (!newValueId) continue;
          attributeIdsUsed.add(legacyAttrId);
          await prisma.productVariantAttributeValue.create({
            data: { variantId: variant.id, attributeValueId: newValueId },
          });
        }
      }

      // Wire up which axes (Attribute) this product uses, derived from the
      // attribute values actually seen across its variants above.
      await prisma.productAttribute.deleteMany({ where: { productId: product.id } });
      const seenAttributeIds = new Set<number>();
      for (const legacyAttrId of attributeIdsUsed) {
        const value = await prisma.attributeValue.findUnique({
          where: { id: attributeValueId.get(legacyAttrId)! },
          select: { attributeId: true },
        });
        if (value && !seenAttributeIds.has(value.attributeId)) {
          seenAttributeIds.add(value.attributeId);
          await prisma.productAttribute.create({
            data: { productId: product.id, attributeId: value.attributeId },
          });
        }
      }
    }
  }

  return { productId: productIdMap, variantRef: variantRefMap };
}
