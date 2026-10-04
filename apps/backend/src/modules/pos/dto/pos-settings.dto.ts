import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpdatePosVatDto {
  @ApiProperty() @IsBoolean() enabled!: boolean;
  @ApiProperty({ example: 15 })
  @IsNumber()
  @Min(0)
  @Max(100)
  ratePercent!: number;
  @ApiProperty({ description: 'true = shelf prices already include VAT' })
  @IsBoolean()
  pricesIncludeVat!: boolean;
  @ApiPropertyOptional({
    description: 'VAT coupon: charge VAT on the receipt, then discount it back',
  })
  @IsOptional()
  @IsBoolean()
  vatDiscount?: boolean;
}

export class UpdatePosLabelDto {
  @ApiProperty({ example: 38 }) @IsNumber() @Min(20) @Max(120) widthMm!: number;
  @ApiProperty({ example: 25 })
  @IsNumber()
  @Min(10)
  @Max(120)
  heightMm!: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showName?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() showSize?: boolean;
}

export class PosExpenseDto {
  @ApiProperty({ example: '2026-10-04' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  date!: string;
  @ApiProperty() @Type(() => Number) @IsInt() categoryId!: number;
  @ApiProperty() @Type(() => Number) @IsNumber() @Min(0.01) amount!: number;
  /** One of the accounts GET expenses/options offers. */
  @ApiProperty() @Type(() => Number) @IsInt() accountId!: number;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(120)
  paidTo?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
