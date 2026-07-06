import { AdminUser } from '@amader/db';

export class AdminProfileDto {
  id!: number;
  email!: string;
  firstName!: string;
  lastName!: string;
  isSuperAdmin!: boolean;
  twoFactorEnabled!: boolean;
}

export function toAdminProfileDto(admin: AdminUser): AdminProfileDto {
  return {
    id: admin.id,
    email: admin.email,
    firstName: admin.firstName,
    lastName: admin.lastName,
    isSuperAdmin: admin.isSuperAdmin,
    twoFactorEnabled: admin.twoFactorEnabled,
  };
}

export class AdminTwoFactorRequiredDto {
  requiresTwoFactor!: boolean;
  twoFactorToken!: string;
}

export class TwoFactorSetupDto {
  secret!: string;
  otpauthUrl!: string;
}
