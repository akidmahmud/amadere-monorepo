import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
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
  @ApiPropertyOptional({
    description:
      'Typed at the till with no customer picked: found or created by this number',
  })
  @IsOptional()
  @Matches(/^(\+?88)?01[3-9]\d{8}$/, {
    message: 'Enter a valid BD mobile number',
  })
  customerPhone?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @Length(1, 80)
  customerName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() couponCode?: string;

  /** Cashier's own discount on the whole sale: ৳ amount or % (with the type). */
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  manualDiscount?: number;
  @ApiPropertyOptional({ enum: ['AMOUNT', 'PERCENT'] })
  @IsOptional()
  @IsIn(['AMOUNT', 'PERCENT'])
  manualDiscountType?: 'AMOUNT' | 'PERCENT';

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
  'manualDiscount',
  'manualDiscountType',
] as const) {}

export class CreateHeldSaleDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() storeId?: number;
  @ApiProperty() @IsString() @Length(1, 60) label!: string;
  @ApiProperty() @IsObject() cart!: Record<string, unknown>;
}

export class EditPosLineDto {
  @ApiProperty() @IsInt() productId!: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() variantId?: number | null;
  @ApiProperty() @IsInt() @Min(0) quantity!: number;
}

export class EditPosSaleDto {
  /** The sale's full new item list. */
  @ApiProperty({ type: [EditPosLineDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => EditPosLineDto)
  items!: EditPosLineDto[];
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  /** New cashier discount (replaces the sale's own); omitted = keep it. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  manualDiscount?: number;
  @ApiPropertyOptional({ enum: ['AMOUNT', 'PERCENT'] })
  @IsOptional()
  @IsIn(['AMOUNT', 'PERCENT'])
  manualDiscountType?: 'AMOUNT' | 'PERCENT';
  /** true = preview the new totals only. */
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dryRun?: boolean;
}

export class ReturnPosLineDto {
  @ApiProperty() @IsInt() itemId!: number;
  @ApiProperty() @IsInt() @IsPositive() qty!: number;
}

export class ReturnPosSaleDto {
  @ApiPropertyOptional() @IsOptional() @IsString() reason?: string;
  /** Lines to return; omitted = everything not yet returned. */
  @ApiPropertyOptional({ type: [ReturnPosLineDto] })
  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ReturnPosLineDto)
  items?: ReturnPosLineDto[];
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
