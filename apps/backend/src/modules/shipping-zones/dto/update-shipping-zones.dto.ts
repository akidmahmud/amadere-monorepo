import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDefined,
  IsNumber,
  IsString,
  Min,
  ValidateNested,
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from 'class-validator';
import { SHIPPING_ZONE_MAX, isKnownDistrict } from '@amader/shared';

export class TranslatedDto {
  @ApiProperty()
  @IsDefined()
  @IsString()
  en!: string;

  @ApiProperty()
  @IsDefined()
  @IsString()
  bn!: string;
}

// A district name that is not in the canonical list would silently never
// match, so the zone would look configured in the admin while every one of
// its customers quietly fell through to the fallback rate. Reject it at the
// boundary rather than let it become a pricing bug nobody can see.
function AreKnownDistricts(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'areKnownDistricts',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          return Array.isArray(value) && value.every((d) => typeof d === 'string' && isKnownDistrict(d));
        },
        defaultMessage(args: ValidationArguments) {
          const bad = Array.isArray(args.value)
            ? (args.value as unknown[]).filter((d) => typeof d !== 'string' || !isKnownDistrict(d))
            : [args.value];
          return `Unknown district(s): ${bad.join(', ')}`;
        },
      },
    });
  };
}

export class ShippingZoneDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  name!: TranslatedDto;

  @ApiProperty({ description: 'What the customer pays, in BDT' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fee!: number;

  @ApiProperty({ type: String, isArray: true })
  @IsArray()
  @AreKnownDistricts()
  districts!: string[];
}

export class ShippingFallbackDto {
  @ApiProperty({ type: TranslatedDto })
  @ValidateNested()
  @Type(() => TranslatedDto)
  name!: TranslatedDto;

  @ApiProperty({ description: 'Applied to every district not assigned to a zone' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fee!: number;
}

// Cross-zone rule: the matcher resolves a duplicated district to whichever
// zone comes first, which is predictable but not what an admin who listed it
// twice intended. Refuse the save so they fix it deliberately.
function HasNoDuplicateDistricts(options?: ValidationOptions) {
  return function (object: object, propertyName: string): void {
    registerDecorator({
      name: 'hasNoDuplicateDistricts',
      target: object.constructor,
      propertyName,
      options,
      validator: {
        validate(value: unknown) {
          if (!Array.isArray(value)) return false;
          const seen = new Set<string>();
          for (const zone of value as ShippingZoneDto[]) {
            for (const d of zone?.districts ?? []) {
              const key = String(d).trim().toLowerCase();
              if (seen.has(key)) return false;
              seen.add(key);
            }
          }
          return true;
        },
        defaultMessage() {
          return 'A district can only belong to one zone';
        },
      },
    });
  };
}

export class UpdateShippingZonesDto {
  @ApiProperty({ type: ShippingZoneDto, isArray: true })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(SHIPPING_ZONE_MAX)
  @ValidateNested({ each: true })
  @Type(() => ShippingZoneDto)
  @HasNoDuplicateDistricts()
  zones!: ShippingZoneDto[];

  @ApiProperty({ type: ShippingFallbackDto })
  @ValidateNested()
  @Type(() => ShippingFallbackDto)
  fallback!: ShippingFallbackDto;
}
