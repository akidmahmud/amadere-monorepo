import { PaymentMethodConfig } from '@amader/db';

export class PaymentMethodConfigDto {
  id!: number;
  provider!: string;
  accountType!: string;
  number!: string;
  instructionsEn!: string | null;
  instructionsBn!: string | null;
  isActive!: boolean;
}

export function toPaymentMethodConfigDto(row: PaymentMethodConfig): PaymentMethodConfigDto {
  return {
    id: row.id,
    provider: row.provider,
    accountType: row.accountType,
    number: row.number,
    instructionsEn: row.instructionsEn,
    instructionsBn: row.instructionsBn,
    isActive: row.isActive,
  };
}
