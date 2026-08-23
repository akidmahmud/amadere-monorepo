import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsInt, IsOptional, IsString } from 'class-validator';

// accountId and paymentDate are required, unlike the DTO this replaced: a
// payment that does not say which account it came from cannot move a balance,
// which is what made cash flow untrustworthy.
export class RecordDuePaymentDto {
  @ApiProperty({ description: 'The instalment, not the running total' })
  @IsString()
  amount!: string;

  @ApiProperty() @IsDateString() paymentDate!: string;
  @ApiProperty() @IsInt() accountId!: number;

  @ApiPropertyOptional({ description: 'bKash TrxID, cheque number, bank reference' })
  @IsOptional()
  @IsString()
  reference?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
