import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsInt, IsOptional, IsString, MinLength } from 'class-validator';

// Shared by expense categories and cost centres: same shape, and they always
// change together. `isVatClaimable` applies only to categories, `code` only to
// cost centres; each service reads the fields it owns.
export class CreateMasterDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiPropertyOptional({ description: 'Categories only — whether input VAT on this category can be claimed' })
  @IsOptional()
  @IsBoolean()
  isVatClaimable?: boolean;

  @ApiPropertyOptional({ description: 'Cost centres only' })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}
