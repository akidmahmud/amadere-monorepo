import { config } from 'dotenv';
import path from 'node:path';
import { createPrismaClient } from '../src/index';

config({ path: path.resolve(__dirname, '../../../.env') });

async function main() {
  const prisma = createPrismaClient(process.env.DATABASE_URL!);

  // 1. Find products marked has_variants = false that still have product_variants rows
  const falseVariantsWithRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT p.id, p.slug, p.has_variants, COUNT(pv.id) as variant_count 
     FROM "products" p 
     JOIN "product_variants" pv ON p.id = pv.product_id 
     WHERE p.has_variants = false AND p.deleted_at IS NULL 
     GROUP BY p.id, p.slug, p.has_variants`
  );
  console.log('1. Products with has_variants = FALSE but HAVE product_variants rows:', falseVariantsWithRows.length);
  if (falseVariantsWithRows.length > 0) {
    console.log(falseVariantsWithRows);
  }

  // 2. Find products marked has_variants = true that have NO variants
  const trueVariantsWithoutRows = await prisma.$queryRawUnsafe<any[]>(
    `SELECT p.id, p.slug, p.has_variants 
     FROM "products" p 
     LEFT JOIN "product_variants" pv ON p.id = pv.product_id 
     WHERE p.has_variants = true AND p.deleted_at IS NULL AND pv.id IS NULL`
  );
  console.log('\n2. Products with has_variants = TRUE but HAVE NO product_variants rows:', trueVariantsWithoutRows.length);
  if (trueVariantsWithoutRows.length > 0) {
    console.log(trueVariantsWithoutRows);
  }

  // 3. Inspect all products with variants
  const allProducts = await prisma.product.findMany({
    where: { deletedAt: null },
    include: { variants: true },
  });

  console.log(`\nTotal non-deleted products: ${allProducts.length}`);
  let countHasVariantsTrue = 0;
  let countHasVariantsFalse = 0;

  for (const p of allProducts) {
    if (p.hasVariants) {
      countHasVariantsTrue++;
      if (p.variants.length === 0) {
        console.log(`  WARNING: Product ID ${p.id} (${p.slug}) hasVariants=true but 0 variants!`);
      }
    } else {
      countHasVariantsFalse++;
      if (p.variants.length > 0) {
        console.log(`  WARNING: Product ID ${p.id} (${p.slug}) hasVariants=false but has ${p.variants.length} variants!`);
      }
    }
  }

  console.log(`Summary: ${countHasVariantsTrue} products have hasVariants=true, ${countHasVariantsFalse} products have hasVariants=false`);

  // 4. Check cart items or recent orders or product cards data
  const sampleProductsWithVariants = allProducts.filter(p => p.hasVariants);
  console.log('\nSample products with hasVariants=true:');
  for (const p of sampleProductsWithVariants.slice(0, 10)) {
    console.log(` Product ${p.id} (${p.slug}): variants = ${p.variants.map(v => v.id).join(', ')}`);
  }

  await prisma.$disconnect();
}

main().catch(console.error);
