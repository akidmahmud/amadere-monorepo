import { randomBytes } from 'node:crypto';

// ORD-YYYYMMDD-<6 hex chars>, e.g. ORD-20260718-1F2A3B. Shared by real
// checkout and manual (admin-created) orders so order numbers are
// indistinguishable between the two paths.
export function generateOrderNumber(): string {
  const now = new Date();
  const ymd = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}`;
  return `ORD-${ymd}-${randomBytes(3).toString('hex').toUpperCase()}`;
}
