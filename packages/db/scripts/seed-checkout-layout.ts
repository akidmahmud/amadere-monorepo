/**
 * Seeds the starting checkout layout (plan §7.2 step 5).
 *
 * This is what the owner begins from when they click "Customise checkout": the
 * current arrangement, already composed from blocks, so their first edit is a
 * rearrangement rather than building a checkout from an empty canvas.
 *
 *   tsx scripts/seed-checkout-layout.ts            # create/update, not live
 *   tsx scripts/seed-checkout-layout.ts --live     # ...and make it the live checkout
 *   tsx scripts/seed-checkout-layout.ts --restore  # clear the live flag (code fallback)
 */
import { config } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { createPrismaClient } from '../src/index';

config({ path: path.resolve(__dirname, '../../../.env') });

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');
const prisma = createPrismaClient(url);

const SLUG = 'checkout-layout';
const LAYOUT = JSON.parse(
  fs.readFileSync(path.resolve(__dirname, 'data/checkout_layout_seed.json'), 'utf-8'),
);

async function main() {
  if (process.argv.includes('--restore')) {
    await prisma.page.updateMany({
      where: { isDefaultCheckout: true },
      data: { isDefaultCheckout: false },
    });
    console.log('live checkout cleared - /checkout falls back to the code layout');
    return;
  }

  const existing = await prisma.page.findUnique({ where: { slug: SLUG } });

  const page = existing
    ? await prisma.page.update({
        where: { id: existing.id },
        data: { kind: 'CHECKOUT', status: 'PUBLISHED' },
      })
    : await prisma.page.create({
        data: {
          slug: SLUG,
          kind: 'CHECKOUT',
          status: 'PUBLISHED',
          translations: {
            create: [
              { locale: 'EN', title: 'Checkout', content: '' },
              { locale: 'BN', title: 'চেকআউট', content: '' },
            ],
          },
        },
      });

  // Both locales get the same document: structure is shared and the text lives
  // in the blocks themselves (owner answer to plan §12.3).
  for (const locale of ['EN', 'BN'] as const) {
    await prisma.pageTranslation.upsert({
      where: { pageId_locale: { pageId: page.id, locale } },
      update: { layout: LAYOUT as never },
      create: {
        pageId: page.id,
        locale,
        title: locale === 'EN' ? 'Checkout' : 'চেকআউট',
        content: '',
        layout: LAYOUT as never,
      },
    });
  }
  console.log(`seeded checkout layout on page #${page.id} (${SLUG})`);

  if (process.argv.includes('--live')) {
    await prisma.$transaction([
      prisma.page.updateMany({
        where: { isDefaultCheckout: true, NOT: { id: page.id } },
        data: { isDefaultCheckout: false },
      }),
      prisma.page.update({ where: { id: page.id }, data: { isDefaultCheckout: true } }),
    ]);
    console.log('this page is now the LIVE checkout');
  }
}

main()
  .catch((err) => {
    console.error('FAILED:', err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
