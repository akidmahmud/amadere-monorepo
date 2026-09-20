import 'reflect-metadata';
import { AdminOrderManagerController } from './admin-order-manager.controller';
import { PERMISSION_KEY } from '../../../common/auth/permission.decorator';

// Assigning an order is an ordinary Order Manager change: it asks for
// net_profit_orders.manage and nothing else. It used to also demand
// assignment.manage, which meant a second box to tick before anyone working
// the Order Manager could hand an order to a colleague.

const permissionsOn = (method: keyof AdminOrderManagerController) =>
  Reflect.getMetadata(
    PERMISSION_KEY,
    AdminOrderManagerController.prototype[method] as object,
  ) as string[];

describe('Order Manager permissions', () => {
  it('assign needs only net_profit_orders.manage', () => {
    expect(permissionsOn('assign')).toEqual(['net_profit_orders.manage']);
  });

  it('bulk (which carries the assign action) needs only net_profit_orders.manage', () => {
    expect(permissionsOn('bulk')).toEqual(['net_profit_orders.manage']);
  });

  it('reading the list still needs the view permission', () => {
    expect(permissionsOn('list')).toEqual(['net_profit_orders.view']);
  });
});
