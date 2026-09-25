import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsInt,
  IsNumber,
  IsObject,
  IsOptional,
  IsPositive,
  IsString,
  Length,
  Matches,
  Min,
  ValidateNested,
} from 'class-validator';

export class PosSaleItemDto {
  @ApiProperty() @IsInt() productId!: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() variantId?: number;
  @ApiProperty() @IsInt() @IsPositive() quantity!: number;
}

export class CreatePosSaleDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() storeId?: number;

  @ApiProperty({ type: [PosSaleItemDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => PosSaleItemDto)
  items!: PosSaleItemDto[];

  @ApiPropertyOptional() @IsOptional() @IsInt() customerId?: number;
  @ApiPropertyOptional() @IsOptional() @IsString() couponCode?: string;

  @ApiProperty({ enum: ['CASH', 'CARD', 'MOBILE'] })
  @IsIn(['CASH', 'CARD', 'MOBILE'])
  tender!: 'CASH' | 'CARD' | 'MOBILE';

  @ApiPropertyOptional({
    description: 'Cash handed over; change = tendered - total',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  tenderedAmount?: number;

  @ApiPropertyOptional({ description: 'bKash/Nagad TrxID or card slip no.' })
  @IsOptional()
  @IsString()
  transactionRef?: string;

  @ApiPropertyOptional() @IsOptional() @IsInt() heldSaleId?: number;
}

/** Same cart shape as a sale, minus payment. */
export class PosQuoteDto extends PickType(CreatePosSaleDto, [
  'storeId',
  'items',
  'customerId',
  'couponCode',
] as const) {}

export class CreateHeldSaleDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() storeId?: number;
  @ApiProperty() @IsString() @Length(1, 60) label!: string;
  @ApiProperty() @IsObject() cart!: Record<string, unknown>;
}

export class ReturnPosSaleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
}

export class PosCustomerQueryDto {
  @ApiProperty() @IsString() q!: string;
}

export class QuickCustomerDto {
  @ApiProperty({ example: '01711111111' })
  @Matches(/^(\+?88)?01[3-9]\d{8}$/, {
    message: 'Enter a valid BD mobile number',
  })
  phone!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @Length(1, 80) name?: string;
}
