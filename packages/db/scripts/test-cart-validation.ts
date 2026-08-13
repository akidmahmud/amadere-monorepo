import { config } from 'dotenv';
import path from 'node:path';
import { createPrismaClient } from '../src/index';

config({ path: path.resolve(__dirname, '../../../.env') });

async function main() {
  const prisma = createPrismaClient(process.env.DATABASE_URL!);

  const products = await prisma.product.findMany({
    where: { deletedAt: null, status: 'PUBLISHED' },
    include: { variants: true },
  });

  console.log(`Testing cart validation for ${products.length} published products...\n`);

  let errorCount = 0;

  for (const product of products) {
    if (product.hasVariants) {
      if (product.variants.length === 0) {
        console.log(`[FAIL] Product ID ${product.id} (${product.slug}): hasVariants=true but has 0 variants!`);
        errorCount++;
      }
      // Test adding with default variant
      const defaultVariant = product.variants.find((v) => v.isDefault) ?? product.variants[0];
      if (!defaultVariant) {
        console.log(`[FAIL] Product ID ${product.id} (${product.slug}): no default variant found!`);
        errorCount++;
      } else {
        // Check if defaultVariant.id belongs to product.variants
        const match = product.variants.find((v) => v.id === defaultVariant.id);
        if (!match) {
          console.log(`[FAIL] Product ID ${product.id} (${product.slug}): defaultVariant ${defaultVariant.id} does not belong to product.variants!`);
          errorCount++;
        }
      }

      // Test all variants attached to product
      for (const v of product.variants) {
        if (v.productId !== product.id) {
          console.log(`[FAIL] Product ID ${product.id} (${product.slug}): variant ${v.id} has productId=${v.productId} mismatch!`);
          errorCount++;
        }
      }
    } else {
      // Product hasVariants = false
      if (product.variants.length > 0) {
        console.log(`[FAIL] Product ID ${product.id} (${product.slug}): hasVariants=false but has ${product.variants.length} variants!`);
        errorCount++;
      }
    }
  }

  console.log(`\nValidation complete. Found ${errorCount} error(s).`);

  await prisma.$disconnect();
}

main().catch(console.error);
