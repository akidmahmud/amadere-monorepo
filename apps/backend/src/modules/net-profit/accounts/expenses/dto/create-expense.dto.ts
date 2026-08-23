import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsIn, IsInt, IsOptional, IsString } from 'class-validator';

export class CreateExpenseDto {
  @ApiProperty() @IsDateString() expenseDate!: string;
  @ApiProperty() @IsInt() categoryId!: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() costCentreId?: number;

  @ApiProperty({ description: 'The payee. Every expense has a counterparty.' })
  @IsInt()
  partyId!: number;

  @ApiProperty({ description: 'Decimal string as typed by the user' })
  @IsString()
  amount!: string;

  @ApiPropertyOptional({
    description: 'True when the typed amount already contains VAT, as most BD supplier bills do',
  })
  @IsOptional()
  @IsBoolean()
  amountIncludesVat?: boolean;

  @ApiPropertyOptional({ description: 'Percent, e.g. "15" or "7.5"' })
  @IsOptional()
  @IsString()
  vatRate?: string;

  @ApiPropertyOptional({ description: 'Mushak 6.3 challan number — required to claim the input VAT' })
  @IsOptional()
  @IsString()
  mushakChallanNo?: string;

  @ApiPropertyOptional({ description: 'AIT percent withheld on the base value' })
  @IsOptional()
  @IsString()
  aitPercent?: string;

  @ApiPropertyOptional({ description: 'Share of the VAT withheld at source: "33.33" or "100"' })
  @IsOptional()
  @IsString()
  vdsPercent?: string;

  @ApiProperty({ enum: ['paid', 'due', 'partial'] })
  @IsIn(['paid', 'due', 'partial'])
  paymentStatus!: 'paid' | 'due' | 'partial';

  @ApiPropertyOptional({ description: 'Required when paymentStatus is "partial"' })
  @IsOptional()
  @IsString()
  paidNow?: string;

  @ApiPropertyOptional({ description: 'Required whenever money actually moves' })
  @IsOptional()
  @IsInt()
  paidFromAccountId?: number;

  @ApiPropertyOptional() @IsOptional() @IsDateString() dueDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() attachmentUrl?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
