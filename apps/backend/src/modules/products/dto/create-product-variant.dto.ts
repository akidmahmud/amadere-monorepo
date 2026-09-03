import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateProductVariantDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  sku?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  barcode?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  price!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  salePrice?: number;

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  stock?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  weightOverride?: number;

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    default: false,
    description:
      'Live for staff, invisible to customers. The product stays public; this variation is excluded from the PDP, search, wishlist, the catalog feed and the parent stock roll-up, and cannot be added to a customer cart. Staff can still sell it from the admin.',
  })
  @IsOptional()
  @IsBoolean()
  isAdminOnly?: boolean;

  @ApiProperty({
    type: [Number],
    description: 'AttributeValue ids that make up this variant, e.g. [Red, M]',
  })
  @IsArray()
  @IsInt({ each: true })
  attributeValueIds!: number[];
}
