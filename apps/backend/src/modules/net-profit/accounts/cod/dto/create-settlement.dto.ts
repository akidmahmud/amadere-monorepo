import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';
import { CourierProviderName } from '@amader/db';

export class CreateSettlementDto {
  @ApiProperty({ enum: CourierProviderName })
  @IsEnum(CourierProviderName)
  provider!: CourierProviderName;

  @ApiProperty() @IsDateString() settlementDate!: string;

  @ApiProperty({
    description: 'What actually landed in the account — the figure on the bank statement, not the expected total',
  })
  @IsString()
  netPayout!: string;

  @ApiProperty({ description: 'The cash account the payout arrived in' })
  @IsInt()
  accountId!: number;

  @ApiPropertyOptional({
    description: 'Limit the batch to these shipments. Omit to settle every eligible one.',
  })
  @IsOptional()
  @IsArray()
  @IsInt({ each: true })
  shipmentIds?: number[];

  @ApiPropertyOptional() @IsOptional() @IsString() reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
