import { registerDecorator, type ValidationOptions } from 'class-validator';
import { isValidBdPhone } from '@amader/shared';

// Same acceptance rule as everywhere else a phone is validated in this app
// (fraud checks, blocker rules, admin/storefront forms) — see
// packages/shared/src/phone.ts's normalizeBdPhone for the single source of
// truth. Accepts local (01XXXXXXXXX) or +880/880/0088-prefixed input.
export function IsBdPhone(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isBdPhone',
      target: object.constructor,
      propertyName,
      options: {
        message: 'must be a valid Bangladeshi mobile number',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown): boolean {
          return typeof value === 'string' && isValidBdPhone(value);
        },
      },
    });
  };
}
