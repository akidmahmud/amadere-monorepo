import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { requireOneStore, resolveStoreScope } from './store-scope';

const yes = () => true;
const no = () => false;

describe('resolveStoreScope', () => {
  it('pins a normal user to their own store, ignoring the requested one', () => {
    expect(resolveStoreScope({ storeId: 2 }, no, 5)).toBe(2);
    expect(resolveStoreScope({ storeId: 2 }, no)).toBe(2);
  });
  it('refuses a normal user with no store', () => {
    expect(() => resolveStoreScope({ storeId: null }, no)).toThrow(
      ForbiddenException,
    );
  });
  it('lets an all-stores user pick, or see all', () => {
    expect(resolveStoreScope({ storeId: 2 }, yes, 5)).toBe(5);
    expect(resolveStoreScope({ storeId: null }, yes)).toBeNull();
  });
});

describe('requireOneStore', () => {
  it('throws on "all stores"', () => {
    expect(() => requireOneStore(null)).toThrow(BadRequestException);
    expect(requireOneStore(3)).toBe(3);
  });
});
