import { AdminUser, AdminUserRole, AdminUserStatus, Role } from '@amader/db';

export interface AdminUserDto {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  status: AdminUserStatus;
  isSuperAdmin: boolean;
  twoFactorEnabled: boolean;
  roles: { id: number; name: string }[];
}

type AdminUserWithRoles = AdminUser & {
  roles: (AdminUserRole & { role: Role })[];
};

export function toAdminUserDto(admin: AdminUserWithRoles): AdminUserDto {
  return {
    id: admin.id,
    email: admin.email,
    firstName: admin.firstName,
    lastName: admin.lastName,
    phone: admin.phone,
    status: admin.status,
    isSuperAdmin: admin.isSuperAdmin,
    twoFactorEnabled: admin.twoFactorEnabled,
    roles: admin.roles.map((r) => ({ id: r.role.id, name: r.role.name })),
  };
}
