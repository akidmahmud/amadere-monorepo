import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  SHIPPING_RULE_MAX,
  SHIPPING_RULE_TIER_MAX,
  isKnownDistrict,
} from '@amader/shared';
import { registerDecorator, ValidationArguments, ValidationOptions } from 'class-validator';

// Same reasoning as the shipping-zones DTO: an unknown district name would
// never match, so the rule would look configured while every parcel for it
// silently fell through to the catch-all.
function AreKnownDistricts(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'areKnownRuleDistricts',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          return (
            Array.isArray(value) &&
            value.every((d) => typeof d === 'string' && isKnownDistrict(d))
          );
        },
        defaultMessage(args: ValidationArguments) {
          const bad = Array.isArray(args.value)
            ? (args.value as unknown[]).filter(
                (d) => typeof d !== 'string' || !isKnownDistrict(d),
              )
            : [args.value];
          return `Unknown district(s): ${bad.join(', ')}`;
        },
      },
    });
  };
}

export class ShippingRuleTierDto {
  @ApiProperty({ description: 'Inclusive upper bound of this weight band, in kg' })
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  upToKg!: number;

  @ApiProperty({ description: 'Courier charge for a parcel in this band, in BDT' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fee!: number;
}

export class ShippingRuleDto {
  @ApiProperty()
  @IsString()
  @MaxLength(64)
  id!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ enum: ['HOME', 'POINT'] })
  @IsIn(['HOME', 'POINT'])
  deliveryType!: 'HOME' | 'POINT';

  @ApiProperty({ type: String, isArray: true, description: 'Empty = catch-all' })
  @IsArray()
  @AreKnownDistricts()
  districts!: string[];

  @ApiProperty({ type: ShippingRuleTierDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SHIPPING_RULE_TIER_MAX)
  @ValidateNested({ each: true })
  @Type(() => ShippingRuleTierDto)
  tiers!: ShippingRuleTierDto[];

  @ApiProperty({ description: 'Per additional whole kg past the last tier' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  perKgFee!: number;
}

export class UpdateShippingRulesDto {
  @ApiProperty({
    description:
      'ON: checkout quotes the rule amount. OFF: checkout keeps quoting the assigned shipping zones.',
  })
  @IsBoolean()
  applyOnCheckout!: boolean;

  @ApiProperty({ type: ShippingRuleDto, isArray: true })
  @IsArray()
  @ArrayMaxSize(SHIPPING_RULE_MAX)
  @ValidateNested({ each: true })
  @Type(() => ShippingRuleDto)
  rules!: ShippingRuleDto[];
}

export class QuoteItemDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  productId?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  variantId?: number | null;

  @ApiProperty()
  @IsInt()
  @Min(1)
  quantity!: number;
}

// One endpoint serves three callers with three different amounts of context:
// Order Manager knows an order id, New Order knows only a draft line-item
// list, and the rules editor's preview knows only a weight. Splitting that
// into three endpoints would triple the surface for one shared calculation.
export class QuoteShippingRuleDto {
  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsInt()
  orderId?: number | null;

  @ApiProperty({ required: false, nullable: true })
  @IsOptional()
  @IsString()
  district?: string | null;

  @ApiProperty({ required: false, type: QuoteItemDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => QuoteItemDto)
  items?: QuoteItemDto[];

  @ApiProperty({ required: false, nullable: true, description: 'Overrides the weight derived from orderId/items' })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0)
  weightKg?: number | null;

  @ApiProperty({ required: false, enum: ['HOME', 'POINT'] })
  @IsOptional()
  @IsIn(['HOME', 'POINT'])
  deliveryType?: 'HOME' | 'POINT';
}

export class ShippingRuleQuoteDto {
  @ApiProperty({ nullable: true, description: 'null when no rule matched' })
  amount!: number | null;

  @ApiProperty({ nullable: true })
  ruleId!: string | null;

  @ApiProperty({ nullable: true })
  ruleName!: string | null;

  @ApiProperty()
  weightKg!: number;

  @ApiProperty({ nullable: true })
  district!: string | null;
}
