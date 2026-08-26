import { config } from 'dotenv';
import path from 'node:path';
import { createPrismaClient } from '../src/index';
config({ path: path.resolve(__dirname, '../../../.env') });
const p = createPrismaClient(process.env.DATABASE_URL!);
(async () => {
  const rows = await p.pageTranslation.findMany({
    where: { OR: [{ NOT: { layout: { equals: null } } }, { NOT: { draftLayout: { equals: null } } }] },
    select: { locale: true, page: { select: { id: true, slug: true, status: true, kind: true, isDefaultCheckout: true } },
              layout: true, draftLayout: true },
  });
  if (!rows.length) console.log('NO page has any layout or draft saved');
  for (const r of rows) {
    console.log(
      `page#${r.page.id} ${r.page.slug} [${r.locale}] status=${r.page.status} kind=${r.page.kind}`,
      '| published layout:', r.layout ? 'YES' : 'no',
      '| draft:', r.draftLayout ? 'YES' : 'no',
    );
  }
  await p.$disconnect();
})();
