import { config } from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { createPrismaClient } from '../src/index';

config({ path: path.resolve(__dirname, '../../../.env') });

interface PageSeedData {
  slug: string;
  titleEn: string;
  titleBn: string;
  content: string;
}

async function main() {
  const targetUrl = process.env.DATABASE_URL;
  if (!targetUrl) {
    throw new Error('DATABASE_URL is required in .env');
  }

  const jsonPath = 'C:/Users/akidm/.gemini/antigravity-ide/brain/05a623d8-6789-4c14-b2f9-153ec3e4c43f/scratch/pages_seed_data.json';
  if (!fs.existsSync(jsonPath)) {
    throw new Error(`Pages seed JSON not found at ${jsonPath}`);
  }

  const pagesData: PageSeedData[] = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
  const prisma = createPrismaClient(targetUrl);

  console.log(`Seeding ${pagesData.length} footer pages into PostgreSQL database...`);

  try {
    for (const data of pagesData) {
      const page = await prisma.page.upsert({
        where: { slug: data.slug },
        create: {
          slug: data.slug,
          status: 'PUBLISHED',
        },
        update: {
          status: 'PUBLISHED',
        },
      });

      // Seed English Translation
      await prisma.pageTranslation.upsert({
        where: {
          pageId_locale: {
            pageId: page.id,
            locale: 'EN',
          },
        },
        create: {
          pageId: page.id,
          locale: 'EN',
          title: data.titleEn,
          content: data.content,
        },
        update: {
          title: data.titleEn,
          content: data.content,
        },
      });

      // Seed Bengali Translation
      await prisma.pageTranslation.upsert({
        where: {
          pageId_locale: {
            pageId: page.id,
            locale: 'BN',
          },
        },
        create: {
          pageId: page.id,
          locale: 'BN',
          title: data.titleBn,
          content: data.content,
        },
        update: {
          title: data.titleBn,
          content: data.content,
        },
      });

      console.log(`✓ Seeded page: ${data.slug} (${data.titleEn})`);
    }

    console.log('\nAll 15 footer pages seeded successfully!');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
