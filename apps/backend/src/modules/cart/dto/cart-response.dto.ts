export class CartDiscountDto {
  source!: 'COUPON' | 'PROMOTION' | 'BUNDLE';
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
