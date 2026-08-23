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

  console.log('Seeding order-lifecycle email templates...');
  const orderEmailTemplates: {
    key: string;
    title: string;
    description: string;
    subject: string;
    bodyHtml: string;
    variables: { key: string; description: string }[];
  }[] = [
    {
      key: 'order_placed',
      title: 'Order Placed',
      description: 'Send email to customer when they place an order',
      subject: 'Your order {{ order_id }} has been received',
      bodyHtml: `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Thanks for your order, {{ customer_name }}!</h2>
<p style="margin:0 0 16px;line-height:1.6;">We've received order <strong>{{ order_id }}</strong> and will confirm it shortly.</p>
<p style="margin:0 0 8px;font-weight:bold;color:#1e2b22;">Items</p>
{{ product_list }}
<p style="margin:16px 0 0;font-weight:bold;color:#1e2b22;">Total: {{ total }}</p>
<p style="margin:16px 0 0;color:#64766b;font-size:13px;">Payment method: {{ payment_method }}</p>
{{ footer }}`,
      variables: [
        { key: 'order_id', description: 'The order number' },
        { key: 'customer_name', description: "The customer's name" },
        { key: 'customer_phone', description: "The customer's phone number" },
        { key: 'customer_address', description: 'The shipping address' },
        { key: 'product_list', description: 'The ordered items, pre-rendered as an HTML list' },
        { key: 'order_note', description: "The customer's order note, if any" },
        { key: 'payment_method', description: 'The payment method used' },
        { key: 'total', description: 'The order total, with currency' },
      ],
    },
    {
      key: 'admin_new_order',
      title: 'New Order (Admin Notice)',
      description: 'Notify staff by email when a new order is placed',
      subject: 'New order {{ order_id }} received',
      bodyHtml: `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">New order {{ order_id }}</h2>
<p style="margin:0 0 4px;"><strong>Customer:</strong> {{ customer_name }} ({{ customer_phone }})</p>
<p style="margin:0 0 16px;"><strong>Address:</strong> {{ customer_address }}</p>
<p style="margin:0 0 8px;font-weight:bold;color:#1e2b22;">Items</p>
{{ product_list }}
<p style="margin:16px 0 0;font-weight:bold;color:#1e2b22;">Total: {{ total }}</p>
<p style="margin:16px 0 0;color:#64766b;font-size:13px;">Payment method: {{ payment_method }}</p>
{{ footer }}`,
      variables: [
        { key: 'order_id', description: 'The order number' },
        { key: 'customer_name', description: "The customer's name" },
        { key: 'customer_phone', description: "The customer's phone number" },
        { key: 'customer_address', description: 'The shipping address' },
        { key: 'product_list', description: 'The ordered items, pre-rendered as an HTML list' },
        { key: 'order_note', description: "The customer's order note, if any" },
        { key: 'payment_method', description: 'The payment method used' },
        { key: 'total', description: 'The order total, with currency' },
      ],
    },
    {
      key: 'order_confirmed',
      title: 'Order Confirmed',
      description: 'Send to customer when their order is confirmed',
      subject: 'Your order {{ order_id }} has been confirmed',
      bodyHtml: `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order is confirmed</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been confirmed and is being prepared.</p>
{{ product_list }}
<p style="margin:16px 0 0;font-weight:bold;color:#1e2b22;">Total: {{ total }}</p>
{{ footer }}`,
      variables: [
        { key: 'order_id', description: 'The order number' },
        { key: 'customer_name', description: "The customer's name" },
        { key: 'customer_phone', description: "The customer's phone number" },
        { key: 'customer_address', description: 'The shipping address' },
        { key: 'product_list', description: 'The ordered items, pre-rendered as an HTML list' },
        { key: 'order_note', description: "The customer's order note, if any" },
        { key: 'payment_method', description: 'The payment method used' },
        { key: 'total', description: 'The order total, with currency' },
      ],
    },
    {
      key: 'order_canceled',
      title: 'Order Canceled',
      description: 'Send to customer when their order is canceled',
      subject: 'Your order {{ order_id }} has been canceled',
      bodyHtml: `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order has been canceled</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been canceled.</p>
<p style="margin:0 0 16px;color:#64766b;"><strong>Reason:</strong> {{ cancellation_reason }}</p>
{{ product_list }}
{{ footer }}`,
      variables: [
        { key: 'order_id', description: 'The order number' },
        { key: 'customer_name', description: "The customer's name" },
        { key: 'customer_phone', description: "The customer's phone number" },
        { key: 'customer_address', description: 'The shipping address' },
        { key: 'product_list', description: 'The ordered items, pre-rendered as an HTML list' },
        { key: 'cancellation_reason', description: 'Why the order was canceled' },
        { key: 'total', description: 'The order total, with currency' },
      ],
    },
    {
      key: 'order_shipped',
      title: 'Order Shipped',
      description: 'Send to customer when their order is dispatched to a courier',
      subject: 'Your order {{ order_id }} is on its way',
      bodyHtml: `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order is on its way!</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been handed to our courier.</p>
<p style="margin:0 0 4px;"><strong>Tracking ID:</strong> {{ tracking_id }}</p>
<p style="margin:0 0 16px;">Track it any time at <a href="{{ tracking_link }}">{{ tracking_link }}</a>.</p>
{{ product_list }}
{{ footer }}`,
      variables: [
        { key: 'order_id', description: 'The order number' },
        { key: 'customer_name', description: "The customer's name" },
        { key: 'customer_phone', description: "The customer's phone number" },
        { key: 'customer_address', description: 'The shipping address' },
        { key: 'product_list', description: 'The ordered items, pre-rendered as an HTML list' },
        { key: 'tracking_id', description: 'The courier tracking code' },
        { key: 'tracking_link', description: 'Link to the storefront order-tracking page' },
        { key: 'total', description: 'The order total, with currency' },
      ],
    },
    {
      key: 'order_delivered',
      title: 'Order Delivered',
      description: 'Send to customer when their order is delivered',
      subject: 'Your order {{ order_id }} has been delivered',
      bodyHtml: `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Your order has arrived!</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, order <strong>{{ order_id }}</strong> has been delivered. We hope you love it!</p>
{{ product_list }}
{{ footer }}`,
      variables: [
        { key: 'order_id', description: 'The order number' },
        { key: 'customer_name', description: "The customer's name" },
        { key: 'customer_phone', description: "The customer's phone number" },
        { key: 'customer_address', description: 'The shipping address' },
        { key: 'product_list', description: 'The ordered items, pre-rendered as an HTML list' },
        { key: 'total', description: 'The order total, with currency' },
      ],
    },
    {
      key: 'payment_confirmed',
      title: 'Payment Confirmed',
      description: "Send to customer when their manual payment is verified",
      subject: "We've received your payment for order {{ order_id }}",
      bodyHtml: `{{ header }}
<h2 style="margin:0 0 16px;color:#1e2b22;">Payment received</h2>
<p style="margin:0 0 16px;line-height:1.6;">Hi {{ customer_name }}, we've confirmed your payment for order <strong>{{ order_id }}</strong>.</p>
<p style="margin:0 0 8px;font-weight:bold;color:#1e2b22;">Amount paid: {{ payment_amount }}</p>
<p style="margin:0 0 16px;color:#64766b;">Order total: {{ total }}</p>
{{ footer }}`,
      variables: [
        { key: 'order_id', description: 'The order number' },
        { key: 'customer_name', description: "The customer's name" },
        { key: 'customer_phone', description: "The customer's phone number" },
        { key: 'customer_address', description: 'The shipping address' },
        { key: 'product_list', description: 'The ordered items, pre-rendered as an HTML list' },
        { key: 'payment_amount', description: 'The amount actually paid in this payment, with currency (may be less than the order total for a partial/advance payment)' },
        { key: 'total', description: "The order's overall total, with currency" },
      ],
    },
  ];
  for (const t of orderEmailTemplates) {
    await prisma.emailTemplate.upsert({
      where: { key: t.key },
      create: {
        key: t.key,
        group: 'ECOMMERCE',
        title: t.title,
        description: t.description,
        subject: t.subject,
        bodyHtml: t.bodyHtml,
        defaultSubject: t.subject,
        defaultBodyHtml: t.bodyHtml,
        variables: t.variables,
        canDisable: true,
        enabled: true,
      },
      // Same "never overwrite a live edit on re-seed" rule as the sub-project 1 seed block.
      update: {},
    });
  }

  // --- Accounts module master data ---------------------------------------
  // Every block below uses `update: {}` so re-seeding never overwrites a live
  // edit — an admin who renames a category or sets a real opening balance
  // keeps it.

  console.log('Seeding accounts expense categories...');
  // Mirrors the list the admin Accounts page used to hardcode as
  // COMMON_CATEGORIES. "Courier & Logistics" is required by name:
  // CodSettlementService books each courier payout's delivery charges
  // against it and fails loudly if it is missing.
  const expenseCategories = [
    { name: 'Rent', isVatClaimable: true, sortOrder: 1 },
    { name: 'Salaries', isVatClaimable: false, sortOrder: 2 },
    { name: 'Utilities', isVatClaimable: true, sortOrder: 3 },
    { name: 'Packaging', isVatClaimable: true, sortOrder: 4 },
    { name: 'Courier & Logistics', isVatClaimable: true, sortOrder: 5 },
    { name: 'Marketing', isVatClaimable: true, sortOrder: 6 },
    { name: 'Software & Subscriptions', isVatClaimable: true, sortOrder: 7 },
    { name: 'Office Supplies', isVatClaimable: true, sortOrder: 8 },
    { name: 'Other', isVatClaimable: true, sortOrder: 9 },
  ];
  for (const category of expenseCategories) {
    await prisma.expenseCategory.upsert({
      where: { name: category.name },
      create: category,
      update: {},
    });
  }

  console.log('Seeding accounts cost centres...');
  await prisma.costCentre.upsert({
    where: { name: 'Head Office' },
    create: { name: 'Head Office', code: 'HO', sortOrder: 1 },
    update: {},
  });

  console.log('Seeding accounts cash accounts...');
  // Opening balances are 0 deliberately. The admin edits each account to its
  // real balance before going live; seeding a guess would make every derived
  // figure wrong in a way that looks authoritative.
  const cashAccounts = [
    { name: 'Cash in hand', type: 'CASH' as const, sortOrder: 1 },
    { name: 'bKash', type: 'MOBILE_WALLET' as const, sortOrder: 2 },
    { name: 'Bank', type: 'BANK' as const, sortOrder: 3 },
  ];
  for (const account of cashAccounts) {
    const exists = await prisma.cashAccount.findFirst({ where: { name: account.name } });
    if (!exists) {
      await prisma.cashAccount.create({
        data: { ...account, openingBalance: 0, openingDate: new Date() },
      });
    }
  }

  console.log('Seeding Steadfast courier party...');
  // Three roles on one record is the point: Steadfast holds our COD cash
  // (they owe us) and invoices us for delivery (we owe them). Only a single
  // party record makes that net position queryable.
  //
  // Pathao, RedX and eCourier are deliberately NOT seeded — the store uses
  // only Steadfast. Adding one later is a party row with its courierProvider
  // set; nothing in the code hardcodes a courier name.
  const steadfast = await prisma.party.findFirst({ where: { courierProvider: 'STEADFAST' } });
  if (!steadfast) {
    await prisma.party.create({
      data: {
        name: 'Steadfast',
        type: 'COMPANY',
        roles: ['COURIER', 'CUSTOMER', 'SUPPLIER'],
        courierProvider: 'STEADFAST',
        note: 'Holds COD cash on our behalf and invoices us for delivery.',
      },
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
