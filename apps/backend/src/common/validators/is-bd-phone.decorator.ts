import { registerDecorator, type ValidationOptions } from 'class-validator';
import { Transform } from 'class-transformer';
import { isValidBdPhone, toBdCompact } from '@amader/shared';

// Site-wide storage/lookup shape: 880XXXXXXXXXX, no +, no spaces, no
// hyphens (packages/shared/src/phone.ts#toBdCompact). Put before
// `@IsBdPhone()` on every phone field so whatever shape the user typed is
// reshaped before it's persisted or used as a lookup key — validation then
// runs against the normalized value. Falls through to the raw value when
// it isn't string/valid so `@IsBdPhone()` still reports the real error
// instead of this silently swallowing it into `undefined`.
export function NormalizeBdPhone() {
  return Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? (toBdCompact(value) ?? value) : value,
  );
}

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
