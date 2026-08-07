export class CartDiscountDto {
  source!: 'COUPON' | 'PROMOTION';
  label!: string;
  amount!: string;
  freeShipping!: boolean;
}

export class FreeShippingLadderDto {
  threshold!: string;
  remaining!: string;
}

export class PricingSummaryDto {
  subTotal!: string;
  discounts!: CartDiscountDto[];
  totalDiscount!: string;
  total!: string;
  couponError!: string | null;
  freeShipping!: FreeShippingLadderDto | null;
  // Real tax/COD-fee preview — same formula CheckoutService uses when the
  // order is actually placed (computeCheckoutFees), so this never drifts
  // from what the customer is really charged. codFee is always '0' unless
  // the caller told us the customer picked Cash on Delivery.
  taxAmount!: string;
  codFee!: string;
  // Flat checkout-time shipping fee (FLAT_SHIPPING_FEE), waived to '0' when
  // an applied discount has freeShipping set.
  shippingFee!: string;
  grandTotal!: string;
}

export class CartLineItemDto {
  id!: number;
  productId!: number;
  variantId!: number | null;
  slug!: string;
  name!: string;
  imageUrl!: string | null;
  variantLabel!: string | null;
  quantity!: number;
  unitPrice!: string;
  lineTotal!: string;
}

export class CartCrossSellItemDto {
  id!: number;
  slug!: string;
  name!: string;
  price!: string | null;
  imageUrl!: string | null;
}

export class CartViewDto extends PricingSummaryDto {
  id!: number | null;
  guestToken!: string | null;
  currency!: string;
  couponCode!: string | null;
  items!: CartLineItemDto[];
  crossSell!: CartCrossSellItemDto[];
}
