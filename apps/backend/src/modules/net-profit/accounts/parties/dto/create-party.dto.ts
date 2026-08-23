import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray, IsBoolean, IsEnum, IsInt, IsNumberString, IsOptional, IsString, MaxLength, MinLength,
} from 'class-validator';
import { CourierProviderName, PartyRole, PartyType } from '@amader/db';

export class CreatePartyDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  name!: string;

  @ApiProperty({ enum: PartyType })
  @IsEnum(PartyType)
  type!: PartyType;

  @ApiProperty({ enum: PartyRole, isArray: true })
  @IsArray()
  @IsEnum(PartyRole, { each: true })
  roles!: PartyRole[];

  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;

  @ApiPropertyOptional({ description: 'VAT registration number — required to claim input VAT on this supplier' })
  @IsOptional()
  @IsString()
  bin?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() tin?: string;

  @ApiPropertyOptional({ description: 'Link to a storefront Customer record' })
  @IsOptional()
  @IsInt()
  customerId?: number;

  @ApiPropertyOptional({ description: 'Opening balance they owe us, as a decimal string' })
  @IsOptional()
  @IsNumberString()
  openingReceivable?: string;

  @ApiPropertyOptional({ description: 'Opening balance we owe them, as a decimal string' })
  @IsOptional()
  @IsNumberString()
  openingPayable?: string;

  @ApiPropertyOptional() @IsOptional() @IsNumberString() creditLimit?: string;
  @ApiPropertyOptional() @IsOptional() @IsInt() creditDays?: number;

  @ApiPropertyOptional({
    enum: CourierProviderName,
    description: 'Marks this party as the one a courier settles against. At most one party per provider.',
  })
  @IsOptional()
  @IsEnum(CourierProviderName)
  courierProvider?: CourierProviderName;

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
}
