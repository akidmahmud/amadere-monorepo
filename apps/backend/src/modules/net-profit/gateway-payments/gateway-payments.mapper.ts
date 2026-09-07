import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Payment, PaymentProvider, PaymentStatus } from '@amader/db';

export class GatewayPaymentDto {
  @ApiProperty()
  id!: number;

  @ApiProperty()
  orderId!: number;

  @ApiProperty({ description: 'Human order number, e.g. ORDER-11127' })
  orderNumber!: string;

  @ApiProperty({ enum: PaymentProvider })
  provider!: PaymentProvider;

  @ApiProperty({ enum: PaymentStatus })
  status!: PaymentStatus;

  @ApiProperty({ description: 'Decimal string, in BDT' })
  amount!: string;

  @ApiPropertyOptional({ nullable: true, description: 'Refunded so far, if any' })
  refundedAmount!: string | null;

  @ApiPropertyOptional({
    nullable: true,
    description:
      "The provider's own transaction id (bKash trxID, e.g. DI709NWKN8) — the field a merchant statement is reconciled against.",
  })
  transactionRef!: string | null;

  @ApiProperty()
  createdAt!: Date;
}

type PaymentWithOrder = Payment & {
  order: { orderNumber: string; status: string } | null;
};

export function toGatewayPaymentDto(p: PaymentWithOrder): GatewayPaymentDto {
  return {
    id: p.id,
    orderId: p.orderId,
    orderNumber: p.order?.orderNumber ?? `#${p.orderId}`,
    provider: p.provider,
    status: p.status,
    amount: p.amount.toString(),
    refundedAmount: p.refundedAmount ? p.refundedAmount.toString() : null,
    transactionRef: p.transactionRef,
    createdAt: p.createdAt,
  };
}
