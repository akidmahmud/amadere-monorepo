import { randomBytes, scrypt } from 'node:crypto';
import { promisify } from 'node:util';
import { PERMISSION_CATALOG } from '@amader/shared';
import { createPrismaClient } from '../src/index';

const scryptAsync = promisify(scrypt);

// Duplicated from apps/backend/src/common/auth/password.util.ts on purpose —
// this package can't depend on the app, and it's a handful of lines.
async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scryptAsync(plain, salt, 64)) as Buffer;
  return `${salt}:${derivedKey.toString('hex')}`;
}

async function main() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required to seed');
  const prisma = createPrismaClient(databaseUrl);

  console.log(`Seeding ${PERMISSION_CATALOG.length} permissions...`);
  for (const permission of PERMISSION_CATALOG) {
    await prisma.permission.upsert({
      where: { key: permission.key },
      create: permission,
      update: { resource: permission.resource, action: permission.action },
    });
  }

  console.log('Seeding Super Admin role...');
  const superAdminRole = await prisma.role.upsert({
    where: { name: 'Super Admin' },
    create: { name: 'Super Admin', description: 'Full access to everything', isSystem: true },
    update: {},
  });

  const allPermissions = await prisma.permission.findMany();
  await prisma.rolePermission.createMany({
    data: allPermissions.map((p) => ({ roleId: superAdminRole.id, permissionId: p.id })),
    skipDuplicates: true,
  });

  const email = process.env.SUPER_ADMIN_EMAIL;
  const password = process.env.SUPER_ADMIN_PASSWORD;
  if (!email || !password) {
    throw new Error('SUPER_ADMIN_EMAIL and SUPER_ADMIN_PASSWORD are required to seed');
  }

  console.log(`Seeding Super Admin user (${email})...`);
  const existing = await prisma.adminUser.findUnique({ where: { email } });
  if (existing) {
    console.log('Super Admin already exists, skipping user creation.');
  } else {
    const passwordHash = await hashPassword(password);
    const admin = await prisma.adminUser.create({
      data: {
        email,
        passwordHash,
        firstName: 'Super',
        lastName: 'Admin',
        isSuperAdmin: true,
        roles: { create: { roleId: superAdminRole.id } },
      },
    });
    console.log(`Created Super Admin #${admin.id}.`);
  }

  await prisma.$disconnect();
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
