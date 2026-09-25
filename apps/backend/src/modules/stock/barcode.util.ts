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

/** Code 128 payload for goods with no manufacturer barcode (loose atta, oil). */
export function internalBarcode(
  productId: number,
  variantId: number | null,
): string {
  return `AMD${String(productId).padStart(6, '0')}${String(variantId ?? 0).padStart(5, '0')}`;
}

/** A 13-digit code is an EAN-13 and must carry a correct check digit; anything else is free-form. */
export function assertBarcode(code: string | null | undefined): void {
  if (code && /^\d{13}$/.test(code) && !isValidEan13(code)) {
    throw new BadRequestException(
      `Barcode ${code}: EAN-13 check digit is wrong`,
    );
  }
}
