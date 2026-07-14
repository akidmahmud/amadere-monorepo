import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CourierProviderName } from '@amader/db';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min, ValidateNested } from 'class-validator';

class PathaoDispatchOptionsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  storeId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  recipientCity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  recipientZone?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  recipientArea?: number;
}

class RedxDispatchOptionsDto {
  @ApiProperty()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  deliveryAreaId!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pickupStoreId?: number;
}

export class DispatchShipmentDto {
  @ApiProperty()
  @IsInt()
  orderId!: number;

  @ApiProperty({ enum: CourierProviderName })
  @IsEnum(CourierProviderName)
  provider!: CourierProviderName;

  // Required only for Pathao/RedX, which need a location selection at
  // consignment-create time — see CreateConsignmentInput.
  @ApiPropertyOptional({ type: PathaoDispatchOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PathaoDispatchOptionsDto)
  pathao?: PathaoDispatchOptionsDto;

  @ApiPropertyOptional({ type: RedxDispatchOptionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RedxDispatchOptionsDto)
  redx?: RedxDispatchOptionsDto;
}
