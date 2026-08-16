import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, Min } from 'class-validator';

export class UpdateVariantWeightDto {
  @ApiPropertyOptional({ description: 'Kilograms. Omit/null to clear and fall back to the product-level shippable weight.' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weightOverride?: number | null;
}
