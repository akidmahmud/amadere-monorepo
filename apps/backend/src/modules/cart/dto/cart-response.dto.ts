import { ApiProperty } from '@nestjs/swagger';

export class CartDiscountDto {
  source!: 'COUPON' | 'PROMOTION' | 'UPSELL';
  label!: string;
  amount!: string;
  freeShipping!: boolean;
}

export class UpsellStageProgressDto {
  label!: string;

  @ApiProperty({ enum: ['ITEM_COUNT', 'ORDER_AMOUNT'] })
  triggerType!: 'ITEM_COUNT' | 'ORDER_AMOUNT';

  triggerValue!: string;
  unlocked!: boolean;
}

export class UpsellNextStageDto {
  label!: string;

  @ApiProperty({ enum: ['ITEM_COUNT', 'ORDER_AMOUNT'] })
  triggerType!: 'ITEM_COUNT' | 'ORDER_AMOUNT';

  remaining!: string;
}

export class UpsellBarDto {
  stages!: UpsellStageProgressDto[];
  currentCount!: string;

  @ApiProperty({ type: UpsellNextStageDto, nullable: true })
  nextStage!: UpsellNextStageDto | null;
}

export class PricingSummaryDto {
  subTotal!: string;
  discounts!: CartDiscountDto[];
  totalDiscount!: string;
  total!: string;
  couponError!: string | null;
  upsell!: UpsellBarDto | null;
  // Real tax/COD-fee preview — same formula CheckoutService uses when the
  // order is actually placed (computeCheckoutFees), so this never drifts
  // from what the customer is really charged. codFee is always '0' unless
  // the caller told us the customer picked Cash on Delivery.
  taxAmount!: string;
  codFee!: string;
  // Checkout-time shipping fee — Dhaka district vs. outside-Dhaka rate (see
  // computeCheckoutFees), waived to '0' when an applied discount has
  // freeShipping set.
  shippingFee!: string;
  grandTotal!: string;
}

export class CartLineItemDto {
  id!: number;
  productId!: number;
  variantId!: number | null;

  // Snapshot of Product.productType for this line. The storefront needs it
  // to decide whether the whole cart is digital-only (isDigitalOnly() in
  // orders/digital-order.util.ts) and therefore whether checkout should
  // collect a shipping address at all — it has no other way to know, and
  // shippingFee === '0' is not a substitute (a free-shipping coupon zeroes
  // that on a perfectly physical cart).
  @ApiProperty({ enum: ['PHYSICAL', 'DIGITAL'] })
  productType!: 'PHYSICAL' | 'DIGITAL';
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

import { PublicProductDto } from '../../products/dto/product-response.dto';

export class CartViewDto extends PricingSummaryDto {
  id!: number | null;
  guestToken!: string | null;
  currency!: string;
  couponCode!: string | null;
  items!: CartLineItemDto[];
  crossSell!: CartCrossSellItemDto[];
  crossSellProducts!: PublicProductDto[];
  frequentlyBoughtTogether!: PublicProductDto[];
}
