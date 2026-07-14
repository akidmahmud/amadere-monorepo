import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsNumber, IsPositive, IsString } from 'class-validator';

export const MANUAL_PAYMENT_METHODS = ['bkash', 'nagad', 'rocket', 'upay'] as const;

export class SubmitManualPaymentDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  orderId!: number;

  @ApiProperty({ enum: MANUAL_PAYMENT_METHODS })
  @IsIn(MANUAL_PAYMENT_METHODS)
  method!: (typeof MANUAL_PAYMENT_METHODS)[number];

  @ApiProperty()
  @IsString()
  senderMsisdn!: string;

  @ApiProperty()
  @IsString()
  trxId!: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @IsPositive()
  amount!: number;
}
