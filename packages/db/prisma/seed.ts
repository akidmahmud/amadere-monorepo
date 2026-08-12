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

  console.log('Seeding default customer tiers...');
  const defaultTiers = [
    { label: 'Group B', minCompletedOrders: 2, sortOrder: 1 },
    { label: 'Group A', minCompletedOrders: 3, sortOrder: 2 },
    { label: 'Gold', minCompletedOrders: 5, sortOrder: 3 },
    { label: 'Platinum', minCompletedOrders: 7, sortOrder: 4 },
  ];
  for (const tier of defaultTiers) {
    await prisma.customerTier.upsert({
      where: { minCompletedOrders: tier.minCompletedOrders },
      create: tier,
      update: { label: tier.label, sortOrder: tier.sortOrder },
    });
  }

  console.log('Seeding email templates...');
  const emailTemplateHeader = `<style>{{ custom_css }}</style>
<div style="background:#f5f6fa;padding:24px 0;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;">
    <div style="background:#2e7d43;padding:20px 30px;text-align:center;">
      {{ logo_html }}
    </div>
    <div style="padding:30px;color:#1e2b22;">`;
  const emailTemplateFooter = `    </div>
    <div style="padding:20px 30px;text-align:center;color:#94a69a;font-size:12px;border-top:1px solid #eef3ef;">
      {{ copyright }}
    </div>
  </div>
</div>`;
  const adminPasswordResetBody = `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Reset your password</h2>
<p style="margin:0 0 20px;line-height:1.6;">Hi {{ admin_name }},</p>
<p style="margin:0 0 20px;line-height:1.6;">We received a request to reset your Amader Admin password. Click the button below to choose a new one — this link expires in 1 hour.</p>
<p style="margin:0 0 24px;text-align:center;">
  <a href="{{ reset_link }}" style="display:inline-block;background:#2e7d43;color:#ffffff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:bold;">Reset Password</a>
</p>
<p style="margin:0;color:#64766b;font-size:13px;line-height:1.6;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
{{ footer }}`;

  const emailTemplates: {
    key: string;
    group: 'BASE' | 'ACL';
    title: string;
    description: string;
    subject: string;
    bodyHtml: string;
    variables: { key: string; description: string }[];
    canDisable: boolean;
  }[] = [
    {
      key: 'core_base_header',
      group: 'BASE',
      title: 'Email template header',
      description: 'Template for header of emails',
      subject: '',
      bodyHtml: emailTemplateHeader,
      variables: [
        { key: 'logo_html', description: 'The site logo, pre-rendered as an <img> tag' },
        { key: 'custom_css', description: 'Custom CSS from Email Template Settings' },
      ],
      canDisable: false,
    },
    {
      key: 'core_base_footer',
      group: 'BASE',
      title: 'Email template footer',
      description: 'Template for footer of emails',
      subject: '',
      bodyHtml: emailTemplateFooter,
      variables: [{ key: 'copyright', description: 'Copyright line from Email Template Settings' }],
      canDisable: false,
    },
    {
      key: 'admin_password_reset',
      group: 'ACL',
      title: 'Reset password',
      description: 'Send email to admin when requesting reset password',
      subject: 'Reset your Amader Admin password',
      bodyHtml: adminPasswordResetBody,
      variables: [
        { key: 'admin_name', description: "The admin's full name" },
        { key: 'reset_link', description: 'One-time password reset link' },
      ],
      canDisable: false,
    },
  ];
  for (const t of emailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { key: t.key },
      create: {
        key: t.key,
        group: t.group,
        title: t.title,
        description: t.description,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        defaultSubject: t.subject,
        defaultBodyHtml: t.bodyHtml,
        variables: t.variables,
        canDisable: t.canDisable,
        enabled: true,
      },
      // Never overwrite an admin's live edits on re-seed — a genuine content
      // change to a seeded template later is a manual DB/backfill decision,
      // not something re-running `prisma:seed` should silently do.
      update: {},
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
