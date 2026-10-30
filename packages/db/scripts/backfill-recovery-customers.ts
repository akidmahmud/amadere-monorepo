import { config } from 'dotenv';
import path from 'node:path';
import { phoneLookupCandidates } from '@amader/shared';
import { createPrismaClient } from '../src/index';

config({ path: path.resolve(__dirname, '../../../.env') });

// One-time: orders recreated from an abandoned cart (REC-…) before
// RecoveryService emitted ORDER_CREATED never got a customer, so they are
// missing from the Customer dashboard. Same rules as
// CustomerOrderEventListener: match an existing customer by phone (any stored
// format), else create one from the shipping address; give a customer with no
// address on file this one as default.
//
// Dry run by default; pass --apply to write. Safe to re-run: only orders that
// still have no customer are picked up.
async function main() {
  const apply = process.argv.includes('--apply');
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required');
  const prisma = createPrismaClient(databaseUrl);

  const orders = await prisma.order.findMany({
    where: { orderNumber: { startsWith: 'REC-' }, customerId: null },
    include: { addresses: { where: { type: 'SHIPPING' }, take: 1 } },
    orderBy: { id: 'asc' },
  });
  console.log(`${orders.length} REC orders without a customer${apply ? '' : ' (dry run, pass --apply to write)'}`);

  let linked = 0;
  let created = 0;
  let skipped = 0;
  for (const order of orders) {
    const address = order.addresses[0];
    if (!address?.phone) {
      skipped++;
      console.log(`  skip ${order.orderNumber}: no shipping phone`);
      continue;
    }
    let customer = await prisma.customer.findFirst({
      where: { phone: { in: phoneLookupCandidates(address.phone) } },
    });
    console.log(`  ${order.orderNumber} -> ${customer ? `customer #${customer.id}` : `new customer ${address.phone}`}`);
    if (!apply) {
      if (customer) linked++;
      else created++;
      continue;
    }

    if (customer) linked++;
    else {
      const [firstName, ...rest] = address.recipientName.trim().split(/\s+/);
      customer = await prisma.customer.create({
        data: {
          phone: address.phone,
          email: address.email ?? undefined,
          firstName: firstName || address.recipientName,
          lastName: rest.length ? rest.join(' ') : null,
        },
      });
      created++;
    }
    await prisma.order.update({ where: { id: order.id }, data: { customerId: customer.id } });

    const hasAddress = await prisma.customerAddress.findFirst({ where: { customerId: customer.id } });
    if (!hasAddress) {
      await prisma.customerAddress.create({
        data: {
          customerId: customer.id,
          recipientName: address.recipientName,
          phone: address.phone,
          division: address.division,
          district: address.district,
          area: address.area,
          landmark: address.landmark,
          addressLine: address.addressLine,
          postCode: address.postCode,
          isDefault: true,
        },
      });
    }
  }

  console.log(`linked to existing: ${linked}, new customers: ${created}, skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
