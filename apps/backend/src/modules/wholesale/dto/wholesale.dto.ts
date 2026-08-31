import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { WholesaleCourier, WholesaleOrderStatus } from '@amader/db';

// ---------------------------------------------------------------------------
// Customers
//
// A wholesale customer is a Party carrying the WHOLESALE role. These DTOs are
// deliberately narrower than CreatePartyDto: the wholesale screen has no
// business offering `courierProvider` or `openingPayable`, and every field it
// does NOT send is one an admin cannot get wrong from here.
// ---------------------------------------------------------------------------

export class CreateWholesaleCustomerDto {
  @ApiProperty({ description: 'Shop or trader name' })
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional({ description: 'Credit ceiling, as a decimal string' })
  @IsOptional()
  @IsNumberString()
  creditLimit?: string;

  @ApiPropertyOptional({ description: 'Payment terms in days' })
  @IsOptional()
  @IsInt()
  @Min(0)
  creditDays?: number;

  @ApiPropertyOptional({
    description:
      'Balance already owed to us when this buyer was entered, as a decimal string',
  })
  @IsOptional()
  @IsNumberString()
  openingReceivable?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateWholesaleCustomerDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(200) name?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(40) phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() creditLimit?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) creditDays?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}

export class WholesaleCustomerQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Type(() => Number) @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Type(() => Number) @Min(1) pageSize?: number;

  @ApiPropertyOptional({ description: 'Matches name, phone or address' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Omit for all' })
  @IsOptional()
  @IsBoolean()
  @Type(() => Boolean)
  isActive?: boolean;
}

// ---------------------------------------------------------------------------
// Orders
// ---------------------------------------------------------------------------

export class WholesaleOrderItemInputDto {
  @ApiPropertyOptional({ description: 'Omit when the line is for a variant' })
  @IsOptional()
  @IsInt()
  productId?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  variantId?: number;

  @ApiProperty({
    description:
      'The wholesale rate for this line, as a decimal string. Not read off the product — wholesale is priced per deal.',
  })
  @IsNumberString()
  unitPrice!: string;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CreateWholesaleOrderDto {
  @ApiProperty({ description: 'Wholesale customer (party) id' })
  @IsInt()
  partyId!: number;

  @ApiProperty({ enum: WholesaleCourier })
  @IsEnum(WholesaleCourier)
  courier!: WholesaleCourier;

  @ApiPropertyOptional({ description: 'The number the courier gives us for the parcel' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  consignmentId?: string;

  @ApiProperty({ type: [WholesaleOrderItemInputDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WholesaleOrderItemInputDto)
  items!: WholesaleOrderItemInputDto[];

  @ApiPropertyOptional({ description: 'Decimal string' })
  @IsOptional()
  @IsNumberString()
  deliveryCharge?: string;

  @ApiPropertyOptional({ description: 'Decimal string' })
  @IsOptional()
  @IsNumberString()
  discount?: string;

  @ApiPropertyOptional({
    description:
      'Paid at the time of the order, as a decimal string. Posts to the ledger; the rest stays outstanding on the receivable.',
  })
  @IsOptional()
  @IsNumberString()
  paidAmount?: string;

  @ApiPropertyOptional({
    description:
      'Cash/bank account the payment lands in. Falls back to the configured default posting account.',
  })
  @IsOptional()
  @IsInt()
  paymentAccountId?: number;

  @ApiPropertyOptional({ enum: WholesaleOrderStatus })
  @IsOptional()
  @IsEnum(WholesaleOrderStatus)
  status?: WholesaleOrderStatus;

  @ApiPropertyOptional({ description: 'ISO date; defaults to today' })
  @IsOptional()
  @IsDateString()
  placedAt?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

/**
 * Editing a placed order.
 *
 * The light fields (status, courier, consignment, note) change nothing but
 * themselves. Supplying `items` — or any of the money fields — is a full
 * restatement of the sale, and the service handles the consequences rather
 * than pretending they do not exist: stock is re-adjusted by the difference,
 * and the receivable this order raised is rewritten to the new total.
 *
 * Two things it will still refuse, because they would leave the ledger
 * describing something untrue: restating a CANCELLED order (its receivable is
 * voided and its goods are back on the shelf), and restating a total to less
 * than has already been collected against it.
 */
export class UpdateWholesaleOrderDto {
  @ApiPropertyOptional({ enum: WholesaleOrderStatus })
  @IsOptional()
  @IsEnum(WholesaleOrderStatus)
  status?: WholesaleOrderStatus;

  @ApiPropertyOptional({ enum: WholesaleCourier })
  @IsOptional()
  @IsEnum(WholesaleCourier)
  courier?: WholesaleCourier;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) consignmentId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;

  @ApiPropertyOptional({
    type: [WholesaleOrderItemInputDto],
    description:
      'Replaces the order lines wholesale. Stock moves by the difference, and the invoice is restated to the new total.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => WholesaleOrderItemInputDto)
  items?: WholesaleOrderItemInputDto[];

  @ApiPropertyOptional({ description: 'Decimal string' })
  @IsOptional()
  @IsNumberString()
  deliveryCharge?: string;

  @ApiPropertyOptional({ description: 'Decimal string' })
  @IsOptional()
  @IsNumberString()
  discount?: string;
}

export class RecordWholesalePaymentDto {
  @ApiProperty({ description: 'Decimal string' })
  @IsNumberString()
  amount!: string;

  @ApiPropertyOptional({ description: 'ISO date; defaults to today' })
  @IsOptional()
  @IsDateString()
  paymentDate?: string;

  @ApiPropertyOptional({ description: 'Falls back to the configured default posting account' })
  @IsOptional()
  @IsInt()
  accountId?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) reference?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
}

export class WholesaleOrderQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsInt() @Type(() => Number) @Min(1) page?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Type(() => Number) @Min(1) pageSize?: number;

  @ApiPropertyOptional({ description: 'Matches order number, consignment id or buyer name' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: WholesaleOrderStatus })
  @IsOptional()
  @IsEnum(WholesaleOrderStatus)
  status?: WholesaleOrderStatus;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Type(() => Number) partyId?: number;
}
