import type { ChangeEvent } from "react";
import { toAsciiDigits } from "@amader/shared";

type RegisterResult = {
  onChange: (event: ChangeEvent<HTMLInputElement>) => unknown;
};

/**
 * Rewrites Bengali numerals to ASCII as the customer types.
 *
 * A Bangla keyboard on Android produces ০১৭… by default, so someone who never
 * switches layouts enters a perfectly correct number that every downstream
 * consumer — the courier API, the SMS gateway, the fraud lookup — would choke
 * on. `normalizeBdPhone` already accepts them, so this is not what makes the
 * number *valid*; it is what stops the field showing one script while the
 * order is stored in another.
 *
 * Converting in the DOM node (rather than only in form state) matters: React
 * Hook Form registers uncontrolled inputs, so writing to state alone would
 * leave the visible text in Bengali.
 *
 * Usage: `<Input {...banglaDigits(register("phone"))} />`
 */
export function banglaDigits<T extends RegisterResult>(field: T): T {
  return {
    ...field,
    onChange: (event: ChangeEvent<HTMLInputElement>) => {
      const converted = toAsciiDigits(event.target.value);
      if (converted !== event.target.value) {
        // Caret position is unaffected: the replacement is one-for-one, so
        // the string length never changes.
        event.target.value = converted;
      }
      return field.onChange(event);
    },
  };
}
