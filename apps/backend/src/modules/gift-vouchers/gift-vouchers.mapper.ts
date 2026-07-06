import { GiftVoucher, GiftVoucherStatus } from '@amader/db';

export class GiftVoucherDto {
  id!: number;
  code!: string;
  initialBalance!: string;
  remainingBalance!: string;
  currency!: string;
  status!: GiftVoucherStatus;
  expiresAt!: Date | null;
  purchasedByCustomerId!: number | null;
}

export function toVoucherDto(voucher: GiftVoucher): GiftVoucherDto {
  return {
    id: voucher.id,
    code: voucher.code,
    initialBalance: voucher.initialBalance.toString(),
    remainingBalance: voucher.remainingBalance.toString(),
    currency: voucher.currency,
    status: voucher.status,
    expiresAt: voucher.expiresAt,
    purchasedByCustomerId: voucher.purchasedByCustomerId,
  };
}

export class GiftVoucherCheckDto {
  code!: string;
  remainingBalance!: string;
  currency!: string;
  usable!: boolean;
}
