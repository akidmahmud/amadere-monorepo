import { ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionGuard } from './permission.guard';
import { ANY_PERMISSION_KEY, PERMISSION_KEY } from './permission.decorator';

function ctx(meta: Record<string, unknown>, request: Record<string, unknown>) {
  const handler = () => undefined;
  for (const [k, v] of Object.entries(meta))
    Reflect.defineMetadata(k, v, handler);
  return {
    getHandler: () => handler,
    switchToHttp: () => ({ getRequest: () => request }),
  } as never;
}

function guardFor(granted: string[], isSuperAdmin = false) {
  const prisma = {
    client: {
      adminUser: {
        findUniqueOrThrow: jest.fn().mockResolvedValue({
          isSuperAdmin,
          roles: [
            {
              role: {
                permissions: granted.map((key) => ({ permission: { key } })),
              },
            },
          ],
        }),
      },
    },
  };
  return new PermissionGuard(new Reflector(), prisma as never);
}

describe('PermissionGuard any-of', () => {
  it('lets through a user holding any one of the listed keys', async () => {
    const req = { adminUser: { id: 1 } } as Record<string, unknown>;
    await expect(
      guardFor(['net_profit_reports.view_own']).canActivate(
        ctx(
          {
            [ANY_PERMISSION_KEY]: [
              'net_profit_reports.view',
              'net_profit_reports.view_own',
            ],
          },
          req,
        ),
      ),
    ).resolves.toBe(true);
    expect(req.adminPermissions).toBeDefined();
  });

  it('rejects a user holding none of them', async () => {
    await expect(
      guardFor(['order.view']).canActivate(
        ctx(
          {
            [ANY_PERMISSION_KEY]: [
              'net_profit_reports.view',
              'net_profit_reports.view_own',
            ],
          },
          { adminUser: { id: 2 } },
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('still requires every key of RequirePermission alongside', async () => {
    await expect(
      guardFor(['net_profit_reports.view_own']).canActivate(
        ctx(
          {
            [PERMISSION_KEY]: ['net_profit_settings.manage'],
            [ANY_PERMISSION_KEY]: ['net_profit_reports.view_own'],
          },
          { adminUser: { id: 3 } },
        ),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });
});
