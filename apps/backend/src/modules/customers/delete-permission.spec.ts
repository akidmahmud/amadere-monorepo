import { ForbiddenException } from '@nestjs/common';
import { AdminCustomersController } from './admin-customers.controller';
import { AdminOrderManagerController } from '../net-profit/order-manager/admin-order-manager.controller';

// Deleting customers and orders needs its own right (customer.delete /
// order.delete): Super Admin, the Admin role, or a role ticked for it —
// "manage" alone is not enough any more.
describe('delete needs its own permission', () => {
  const can = (granted: string[]) => (key: string) => granted.includes(key);

  it('customers: bulk delete and permanent delete need customer.delete; restore does not', () => {
    const customers = { adminBulkAction: jest.fn().mockReturnValue('ok') };
    const c = new AdminCustomersController(customers as never);
    const ids = { customerIds: [1] };
    expect(() => c.bulk({ ...ids, action: 'delete' } as never, can(['customer.manage']))).toThrow(ForbiddenException);
    expect(() => c.bulk({ ...ids, action: 'purge' } as never, can(['customer.manage']))).toThrow(ForbiddenException);
    expect(c.bulk({ ...ids, action: 'restore' } as never, can(['customer.manage']))).toBe('ok');
    expect(c.bulk({ ...ids, action: 'delete' } as never, can(['customer.manage', 'customer.delete']))).toBe('ok');
  });

  it('Order Manager: bulk delete needs order.delete; other actions do not', () => {
    const orderManager = { bulkAction: jest.fn().mockReturnValue('ok') };
    const c = new AdminOrderManagerController(orderManager as never);
    const admin = { id: 1 };
    expect(() => c.bulk({ orderIds: [1], action: 'delete' } as never, admin, can([]))).toThrow(ForbiddenException);
    expect(c.bulk({ orderIds: [1], action: 'hold' } as never, admin, can([]))).toBe('ok');
    expect(c.bulk({ orderIds: [1], action: 'delete' } as never, admin, can(['order.delete']))).toBe('ok');
  });

  it('Order Manager: bulk Export Excel needs data.export', () => {
    const orderManager = { bulkAction: jest.fn().mockReturnValue('ok') };
    const c = new AdminOrderManagerController(orderManager as never);
    const admin = { id: 1 };
    expect(() => c.bulk({ orderIds: [1], action: 'export' } as never, admin, can([]))).toThrow(ForbiddenException);
    expect(c.bulk({ orderIds: [1], action: 'export' } as never, admin, can(['data.export']))).toBe('ok');
  });

  it('export and payment change need their own rights', () => {
    const { PERMISSION_KEY } = jest.requireActual('../../common/auth/permission.decorator');
    const { AdminOrdersController } = jest.requireActual('../orders/admin-orders.controller');
    const keys = (cls: { prototype: object }, m: string) =>
      Reflect.getMetadata(PERMISSION_KEY, (cls.prototype as Record<string, object>)[m]) as string[];
    expect(keys(AdminCustomersController, 'export')).toContain('data.export');
    expect(keys(AdminOrdersController, 'updatePayment')).toContain('payment.update');
  });
});
