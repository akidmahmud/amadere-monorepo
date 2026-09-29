export interface PosProduct {
  productId: number;
  variantId: number | null;
  name: string;
  variantLabel?: string | null;
  sku?: string | null;
  barcode?: string | null;
  price: string;
  salePrice: string | null;
  imageUrl?: string | null;
  /** true = imageUrl is this store's own photo. */
  storeImage?: boolean;
  categoryIds?: number[];
  stock: number;
  storeOnly?: boolean;
  /** true = price/salePrice are this store's own (POS store price). */
  storePrice?: boolean;
  /** true = `name` is this store's own name for it. */
  storeName?: boolean;
  normalName?: string;
  /** kg: this store's own weight, and the product's normal one. */
  storeWeightKg?: string | null;
  normalWeightKg?: string | null;
  storeWeightUnit?: string | null;
  normalWeightUnit?: string | null;
  normalPrice?: string;
  normalSalePrice?: string | null;
}

export interface CartLine extends PosProduct {
  key: string;
  qty: number;
}

export type CartAction =
  | { type: "add"; product: PosProduct }
  | { type: "setQty"; key: string; qty: number }
  | { type: "remove"; key: string }
  | { type: "load"; lines: CartLine[] }
  | { type: "clear" };

export const lineKey = (p: { productId: number; variantId: number | null }) =>
  `${p.productId}:${p.variantId ?? 0}`;
export const unitPrice = (p: PosProduct) => Number(p.salePrice ?? p.price);

export function cartReducer(cart: CartLine[], a: CartAction): CartLine[] {
  switch (a.type) {
    case "add": {
      if (a.product.stock <= 0) return cart;
      const key = lineKey(a.product);
      const hit = cart.find((l) => l.key === key);
      if (!hit) return [...cart, { ...a.product, key, qty: 1 }];
      return cartReducer(cart, { type: "setQty", key, qty: hit.qty + 1 });
    }
    case "setQty":
      return cart
        .map((l) =>
          l.key === a.key
            ? { ...l, qty: Math.min(Math.max(0, Math.floor(a.qty)), l.stock) }
            : l,
        )
        .filter((l) => l.qty > 0);
    case "remove":
      return cart.filter((l) => l.key !== a.key);
    case "load":
      return a.lines;
    case "clear":
      return [];
  }
}

/** Display-only; the server recomputes every total. */
export const cartSubtotal = (cart: CartLine[]) =>
  cart.reduce((s, l) => s + unitPrice(l) * l.qty, 0);
export const cartCount = (cart: CartLine[]) =>
  cart.reduce((s, l) => s + l.qty, 0);
export const taka = (n: number | string) =>
  `৳ ${Number(n).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/**
 * Typing into the qty box: an emptied or non-numeric field keeps the current
 * quantity (backspacing to retype must not delete the line); only the × / −
 * buttons remove it.
 */
export function parseQtyInput(raw: string, current: number): number {
  const t = raw.trim();
  if (!/^\d+$/.test(t) || Number(t) < 1) return current;
  return Number(t);
}

/** "01XXXXXXXXX" for a Bangladeshi mobile in any common form (+880…, spaces, dashes), else null. */
export function normalizeBdPhone(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "").replace(/^\+/, "");
  const local = digits.startsWith("880") ? digits.slice(2) : digits;
  return /^01[3-9]\d{8}$/.test(local) ? local : null;
}

/**
 * Cart lines the server says can no longer be sold here (product deleted,
 * moved to another store, or a variant removed) — from its quote error.
 */
export function unsellableLines(message: string, cart: CartLine[]): CartLine[] {
  const product = /Product #(\d+) is not sold at this store/.exec(message);
  if (product) return cart.filter((l) => l.productId === Number(product[1]));
  const variant = /Variant #(\d+) does not belong/.exec(message);
  if (variant) return cart.filter((l) => l.variantId === Number(variant[1]));
  return [];
}
