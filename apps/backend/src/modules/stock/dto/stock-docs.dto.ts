import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  Min,
  NotEquals,
  ValidateNested,
} from 'class-validator';
import { StoreQueryDto } from '../../stores/dto/store.dto';
import { ADJUST_REASONS } from '../stock-docs.service';

export class StockInLineDto {
  @ApiProperty() @IsInt() productId!: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() variantId?: number;
  @ApiProperty() @IsInt() @IsPositive() qty!: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) unitCost?: number;
}

export class CreateStockInDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() storeId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() supplierPartyId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;

  @ApiProperty({ type: [StockInLineDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => StockInLineDto)
  lines!: StockInLineDto[];
}

export class AdjustStockDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() storeId?: number;
  @ApiProperty() @IsInt() productId!: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() variantId?: number;
  @ApiProperty({ description: 'Signed: + adds, - removes' })
  @IsInt()
  @NotEquals(0)
  qty!: number;
  @ApiProperty({ enum: ADJUST_REASONS })
  @IsIn([...ADJUST_REASONS])
  reason!: (typeof ADJUST_REASONS)[number];
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}

export class MovementsQueryDto extends StoreQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  productId?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  variantId?: number;
}

export class GenerateBarcodesDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  productIds!: number[];
}
