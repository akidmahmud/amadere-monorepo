import { Permission, Role, RolePermission } from '@amader/db';

export interface RoleDto {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissionKeys: string[];
}

type RoleWithPermissions = Role & {
  permissions: (RolePermission & { permission: Permission })[];
};

export function toRoleDto(role: RoleWithPermissions): RoleDto {
  return {
    id: role.id,
    name: role.name,
    description: role.description,
    isSystem: role.isSystem,
    permissionKeys: role.permissions.map((p) => p.permission.key),
  };
}

export function toPermissionDto(permission: Permission) {
  return {
    id: permission.id,
    resource: permission.resource,
    action: permission.action,
    key: permission.key,
  };
}
