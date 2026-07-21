import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class UpdateVariantSkuDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;
}
