/**
 * A cart or order is "digital-only" when every line is a digital product.
 *
 * Mixed carts are deliberately NOT digital-only: there is a parcel to ship, so
 * shipping, address and the dispatch queue all still apply. An empty list is
 * false rather than vacuously true — otherwise an empty cart would skip
 * address collection.
 */
export function isDigitalOnly(lines: { productType: string }[]): boolean {
  return lines.length > 0 && lines.every((l) => l.productType === 'DIGITAL');
}
