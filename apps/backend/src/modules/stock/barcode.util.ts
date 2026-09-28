import { BadRequestException } from '@nestjs/common';

export function ean13CheckDigit(first12: string): number {
  const sum = [...first12].reduce(
    (s, ch, i) => s + Number(ch) * (i % 2 === 0 ? 1 : 3),
    0,
  );
  return (10 - (sum % 10)) % 10;
}

export function isValidEan13(code: string): boolean {
  return (
    /^\d{13}$/.test(code) &&
    ean13CheckDigit(code.slice(0, 12)) === Number(code[12])
  );
}

/**
 * Barcode for goods with no manufacturer barcode (loose atta, oil): an
 * in-store EAN-13 — "2" (GS1's restricted-circulation prefix, never on a
 * real product) + 6-digit product id + 5-digit variant id + check digit.
 * EAN-13 is what 1D laser scanners read best, and it is short enough to
 * print on a 40mm label at 203 dpi with whole-dot bars and proper margins
 * (the old 14-char "AMD…" Code 128 codes were borderline there; they still
 * scan, since lookup matches whatever barcode is stored).
 * ponytail: ids above 999999 / 99999 would need a different scheme.
 */
export function internalBarcode(
  productId: number,
  variantId: number | null,
): string {
  const first12 = `2${String(productId).padStart(6, '0')}${String(variantId ?? 0).padStart(5, '0')}`;
  return `${first12}${ean13CheckDigit(first12)}`;
}

/** An old-format internal code (before 2026-09-28): "AMD" + 11 digits. */
export const isLegacyInternalBarcode = (code: string | null | undefined) =>
  !!code && /^AMD\d{11}$/.test(code);

/** A 13-digit code is an EAN-13 and must carry a correct check digit; anything else is free-form. */
export function assertBarcode(code: string | null | undefined): void {
  if (code && /^\d{13}$/.test(code) && !isValidEan13(code)) {
    throw new BadRequestException(
      `Barcode ${code}: EAN-13 check digit is wrong`,
    );
  }
}
