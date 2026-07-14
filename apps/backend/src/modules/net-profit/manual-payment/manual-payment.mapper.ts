import { ManualPayment } from '@amader/db';

export class ManualPaymentDto {
  id!: number;
  orderId!: number;
  method!: string;
  senderMsisdn!: string;
  trxId!: string;
  amount!: string;
  screenshotUrl!: string | null;
  status!: string;
  verifiedBy!: number | null;
  createdAt!: Date;
}

export function toManualPaymentDto(row: ManualPayment): ManualPaymentDto {
  return {
    id: row.id,
    orderId: row.orderId,
    method: row.method,
    senderMsisdn: row.senderMsisdn,
    trxId: row.trxId,
    amount: row.amount.toString(),
    screenshotUrl: row.screenshotUrl,
    status: row.status,
    verifiedBy: row.verifiedBy,
    createdAt: row.createdAt,
  };
}
