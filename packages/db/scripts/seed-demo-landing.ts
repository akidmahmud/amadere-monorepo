/**
 * Publishes the demo landing page: a pasted HTML design with a real checkout
 * block portalled into the middle of it.
 *
 *   tsx scripts/seed-demo-landing.ts          # publish at /fiber-mix-demo
 *   tsx scripts/seed-demo-landing.ts --clear  # delete the page
 *
 * The HTML in data/demo_landing.html is the owner's own design; the only edit
 * is that the static order card was replaced by a one-line placeholder:
 *
 *   <div data-amader-block="CheckoutProductCard" data-product-slug="..."></div>
 */
import { config } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { createPrismaClient } from '../src/index';

config({ path: path.resolve(__dirname, '../../../.env') });
const prisma = createPrismaClient(process.env.DATABASE_URL!);

const SLUG = 'fiber-mix-demo';
const HTML = fs.readFileSync(
  path.resolve(__dirname, 'data/demo_landing.html'),
  'utf-8',
);

const DOC = {
  root: { props: {} },
  content: [
    {
      type: 'HtmlPage',
      // `inline` so the page is server-rendered and indexable; the block is
      // portalled in on the client.
      props: {
        id: 'demo-html',
        html: HTML,
        mode: 'inline',
        // Landing page: it owns the viewport, no site header/footer around it.
        fullBleed: 'yes',
        minHeight: 800,
      },
    },
  ],
};

async function main() {
  const clear = process.argv.includes('--clear');
  const existing = await prisma.page.findUnique({ where: { slug: SLUG } });

  if (clear) {
    if (existing) await prisma.page.delete({ where: { id: existing.id } });
    console.log(`/${SLUG} deleted`);
    return;
  }

  const page =
    existing ??
    (await prisma.page.create({
      data: {
        slug: SLUG,
        kind: 'CONTENT',
        status: 'PUBLISHED',
        translations: {
          create: [
            { locale: 'EN', title: 'Amader Fiber Mix', content: '' },
            { locale: 'BN', title: 'আমাদের ফাইবার মিক্স', content: '' },
          ],
        },
      },
    }));

  await prisma.page.update({
    where: { id: page.id },
    data: { status: 'PUBLISHED' },
  });
  await prisma.pageTranslation.upsert({
    where: { pageId_locale: { pageId: page.id, locale: 'EN' } },
    update: { layout: DOC as never },
    create: {
      pageId: page.id,
      locale: 'EN',
      title: 'Amader Fiber Mix',
      content: '',
      layout: DOC as never,
    },
  });
  console.log(`published /${SLUG} (page #${page.id}), ${HTML.length} bytes of HTML`);
}

main()
  .catch((e) => {
    console.error('FAILED:', e.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
