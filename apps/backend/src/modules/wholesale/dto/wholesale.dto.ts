import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsObject,
  IsNumberString,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { NormalizeBdPhone } from '../../../common/validators/is-bd-phone.decorator';
import { CHANNEL_FIELD_TYPES, type ChannelFieldType } from '../wholesale-channel-fields';
import {
  CustomerBehaviour,
  CustomerCrmStatus,
  CustomerPriority,
  WholesaleCourier,
  WholesalePriceList,
  WholesaleOrderChannel,
  WholesaleOrderStatus,
  WholesaleOrderType,
  WholesalePaymentMethod,
} from '@amader/db';

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

  // Reshaped to the site-wide 880XXXXXXXXXX form, which also transliterates a
  // number typed in Bengali numerals — without it a Bangla-keyboard entry is
  // stored as ০১৭… and every SMS, courier booking and fraud lookup against it
  // fails. Deliberately NOT paired with @IsBdPhone(): that demands an 01
  // prefix, and a shop's landline should still be storable.
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(40)
  @NormalizeBdPhone()
  phone!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  address?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) alternativePhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) thana?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) landmark?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) postCode?: string;

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
  @ApiPropertyOptional() @IsOptional() @IsString() @MinLength(1) @MaxLength(40) @NormalizeBdPhone() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) alternativePhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) thana?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) landmark?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) postCode?: string;
  @ApiPropertyOptional() @IsOptional() @IsNumberString() creditLimit?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Min(0) creditDays?: number;

  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(1000) note?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;

  // CRM columns — the same set and validation as UpdateCustomerDto, so the
  // wholesale Customer Dashboard edits them exactly like retail. Dates are
  // ISO strings, or null to clear.
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isFavorite?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() dob?: string | null;
  @ApiPropertyOptional({ description: 'Admin staff user ID, or null to unassign' }) @IsOptional() @IsInt() assignedAdminId?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsDateString() nextCallTarget?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsInt() followUpCadenceDays?: number | null;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() hasNewOrder?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsDateString() newOrderAt?: string | null;
  @ApiPropertyOptional({ enum: CustomerPriority }) @IsOptional() @IsEnum(CustomerPriority) priority?: CustomerPriority | null;
  @ApiPropertyOptional({ enum: CustomerCrmStatus }) @IsOptional() @IsEnum(CustomerCrmStatus) crmStatus?: CustomerCrmStatus | null;
  @ApiPropertyOptional({ enum: CustomerBehaviour }) @IsOptional() @IsEnum(CustomerBehaviour) behaviour?: CustomerBehaviour | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) customerFeedback?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) amaderFeedback?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) familyDetails?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) purchaseReason?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) facebookProfileUrl?: string;
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

  @ApiPropertyOptional({
    description: 'Taka off THIS line, before the order-level discount. Decimal string.',
  })
  @IsOptional()
  @IsNumberString()
  discount?: string;
}

/** Where the order goes. Recorded for a cash sale too — only the COURIER is
 *  wholesale-only, not the address. */
export class WholesaleDeliveryInputDto {
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) recipientName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) recipientPhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(40) alternativePhone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) recipientEmail?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(500) addressLine?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) district?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(100) thana?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) landmark?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(20) postCode?: string;
}

export class CreateWholesaleOrderDto {
  @ApiProperty({ description: 'Wholesale customer (party) id' })
  @IsInt()
  partyId!: number;

  @ApiPropertyOptional({
    enum: WholesaleOrderType,
    description: 'Defaults to WHOLESALE. CHANNEL orders need `channelId`; the channel decides whether there is a delivery leg.',
  })
  @IsOptional()
  @IsEnum(WholesaleOrderType)
  type?: WholesaleOrderType;

  @ApiPropertyOptional({ enum: WholesaleOrderChannel, description: 'Where a WHOLESALE order came in from (WhatsApp, phone...).' })
  @IsOptional()
  @IsEnum(WholesaleOrderChannel)
  channel?: WholesaleOrderChannel;

  @ApiPropertyOptional({ description: 'The sales channel (Cash Sale, Daraz...). CHANNEL orders only.' })
  @IsOptional()
  @IsInt()
  channelId?: number;

  @ApiPropertyOptional({ description: "Values for the channel's custom fields, keyed by field key." })
  @IsOptional()
  @IsObject()
  channelData?: Record<string, unknown>;

  @ApiPropertyOptional({ enum: WholesalePaymentMethod })
  @IsOptional()
  @IsEnum(WholesalePaymentMethod)
  paymentMethod?: WholesalePaymentMethod;

  @ApiPropertyOptional({ description: 'Required by the UI for every non-cash method' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transactionId?: string;

  @ApiPropertyOptional({
    enum: WholesaleCourier,
    description: 'Required for WHOLESALE and for channels with delivery; refused for channels without (Cash Sale).',
  })
  @IsOptional()
  @IsEnum(WholesaleCourier)
  courier?: WholesaleCourier;

  @ApiPropertyOptional({ type: WholesaleDeliveryInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => WholesaleDeliveryInputDto)
  delivery?: WholesaleDeliveryInputDto;

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

  @ApiPropertyOptional({ description: "Channel orders: the full set of values for the channel's custom fields. Replaces what is stored, so send every value, not just the changed one." })
  @IsOptional()
  @IsObject()
  channelData?: Record<string, unknown>;

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

  @ApiPropertyOptional({
    description:
      "Matches order number, consignment id, buyer name or phone, recipient name or phone, the channel's field values, transaction id, or any product on the order",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: WholesaleOrderStatus })
  @IsOptional()
  @IsEnum(WholesaleOrderStatus)
  status?: WholesaleOrderStatus;

  @ApiPropertyOptional({ enum: WholesaleOrderType, description: 'Omit for both' })
  @IsOptional()
  @IsEnum(WholesaleOrderType)
  type?: WholesaleOrderType;

  @ApiPropertyOptional() @IsOptional() @IsInt() @Type(() => Number) partyId?: number;
  @ApiPropertyOptional() @IsOptional() @IsInt() @Type(() => Number) channelId?: number;
}

// ---------------------------------------------------------------------------
// Channels (Wholesale -> Channel Settings)
// ---------------------------------------------------------------------------

export class WholesaleChannelFieldInputDto {
  @ApiPropertyOptional({ description: 'Keep the existing key when editing a field; omit for a new one' })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  key?: string;

  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) label!: string;

  @ApiProperty({ enum: CHANNEL_FIELD_TYPES })
  @IsIn(CHANNEL_FIELD_TYPES)
  type!: ChannelFieldType;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() required?: boolean;
  @ApiPropertyOptional({ description: 'Show this value as a column in the orders table' }) @IsOptional() @IsBoolean() showInTable?: boolean;

  @ApiPropertyOptional({ type: [String], description: 'Dropdown choices' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  options?: string[];
}

export class CreateWholesaleChannelDto {
  @ApiProperty() @IsString() @MinLength(1) @MaxLength(80) name!: string;

  @ApiProperty({ enum: WholesalePriceList, description: 'Which product price the cart starts from' })
  @IsEnum(WholesalePriceList)
  priceList!: WholesalePriceList;

  @ApiProperty({ description: 'false = handed over on the spot: no courier, no delivery charge' })
  @IsBoolean()
  hasDelivery!: boolean;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;

  @ApiProperty({ type: [WholesaleChannelFieldInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WholesaleChannelFieldInputDto)
  fields!: WholesaleChannelFieldInputDto[];
}

export class UpdateWholesaleChannelDto extends PartialType(CreateWholesaleChannelDto) {}
