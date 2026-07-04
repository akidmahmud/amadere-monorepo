import type { Connection } from 'mysql2/promise';
import type { PrismaClient } from '../../src/index';
import { detectDivisionDistrict } from './bd-geo';
import { bump, type MigrationReport } from './report';

function splitName(fullName: string): { firstName: string; lastName: string | null } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: null };
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

export async function migrateCustomers(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
): Promise<Map<number, number>> {
  const [rows] = await source.query<any[]>('SELECT * FROM ec_customers');
  const idMap = new Map<number, number>();
  bump(report, 'customers', 'source', rows.length);
  report.notes.push(
    'Every migrated Customer has passwordHash=null — the old system hashed' +
      ' passwords with bcrypt, the new one with scrypt, so old hashes cannot' +
      ' be reused. Migrated customers must use "forgot password" or OTP' +
      ' login to set a new one; this is an expected, unavoidable consequence' +
      ' of the auth-system rebuild, not a migration defect.',
  );

  for (const row of rows) {
    const { firstName, lastName } = splitName(row.name);
    const customer = await prisma.customer.upsert({
      where: { legacyId: row.id },
      create: {
        legacyId: row.id,
        email: row.email || null,
        phone: row.phone || null,
        passwordHash: null,
        firstName,
        lastName,
        avatarUrl: row.avatar ? `legacy://${row.avatar}` : null,
        dob: row.dob,
        status: row.status === 'activated' ? 'ACTIVE' : 'LOCKED',
        phoneVerifiedAt: row.phone_verified_at,
        createdAt: row.created_at ?? new Date(),
      },
      update: {
        email: row.email || null,
        phone: row.phone || null,
        firstName,
        lastName,
      },
    });
    idMap.set(row.id, customer.id);
    bump(report, 'customers', 'migrated');
  }

  return idMap;
}

export async function migrateCustomerAddresses(
  source: Connection,
  prisma: PrismaClient,
  report: MigrationReport,
  customerId: Map<number, number>,
): Promise<void> {
  const [rows] = await source.query<any[]>('SELECT * FROM ec_customer_addresses');
  bump(report, 'customer_addresses', 'source', rows.length);

  for (const row of rows) {
    const newCustomerId = customerId.get(row.customer_id);
    if (!newCustomerId) {
      bump(report, 'customer_addresses', 'skipped');
      continue;
    }

    const addressText = row.address ?? '';
    const { division, district, matched } = detectDivisionDistrict(addressText);
    if (!matched) {
      report.addressesDefaulted.push({
        model: 'CustomerAddress',
        legacyId: row.id,
        addressLine: addressText,
      });
    }

    // No natural unique key on the old side; find-or-create on
    // (customer, address text) so re-runs don't duplicate.
    const existing = await prisma.customerAddress.findFirst({
      where: { customerId: newCustomerId, addressLine: addressText },
    });
    if (existing) {
      bump(report, 'customer_addresses', 'skipped');
      continue;
    }

    await prisma.customerAddress.create({
      data: {
        customerId: newCustomerId,
        recipientName: row.name,
        phone: row.phone ?? '',
        division,
        district,
        addressLine: addressText,
        postCode: row.zip_code || null,
        isDefault: !!row.is_default,
        createdAt: row.created_at ?? new Date(),
      },
    });
    bump(report, 'customer_addresses', 'migrated');
  }
}
