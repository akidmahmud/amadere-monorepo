import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, Max, Min } from 'class-validator';

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
  @ApiProperty({ example: 25 }) @IsNumber() @Min(10) @Max(120) heightMm!: number;
}
