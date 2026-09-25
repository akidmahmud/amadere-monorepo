import { AdminUser } from '@amader/db';

export class AdminProfileDto {
  id!: number;
  email!: string;
  firstName!: string;
  lastName!: string;
  isSuperAdmin!: boolean;
  twoFactorEnabled!: boolean;
  // Effective granted permission keys (union across every assigned role) —
  // empty for a super admin, since isSuperAdmin already bypasses every
  // permission check (backend PermissionGuard and the frontend nav filter
  // both check isSuperAdmin first).
  permissions!: string[];
  /** POS home store; null = none assigned. */
  storeId!: number | null;
}

export function toAdminProfileDto(admin: AdminUser, permissions: string[] = []): AdminProfileDto {
  return {
    id: admin.id,
    email: admin.email,
    firstName: admin.firstName,
    lastName: admin.lastName,
    isSuperAdmin: admin.isSuperAdmin,
    twoFactorEnabled: admin.twoFactorEnabled,
    permissions,
    storeId: admin.storeId,
  };
}

export class AdminTwoFactorRequiredDto {
  requiresTwoFactor!: boolean;
  twoFactorToken!: string;
}
