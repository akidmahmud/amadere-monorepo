import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString, MinLength } from 'class-validator';
import { CashAccountType } from '@amader/db';

export class CreateCashAccountDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ enum: CashAccountType })
  @IsEnum(CashAccountType)
  type!: CashAccountType;

  @ApiPropertyOptional() @IsOptional() @IsString() accountNumber?: string;

  @ApiPropertyOptional({ description: 'Decimal string. The real balance on openingDate.' })
  @IsOptional()
  @IsString()
  openingBalance?: string;

  @ApiProperty({ description: 'The date the opening balance is true as at' })
  @IsDateString()
  openingDate!: string;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsInt() sortOrder?: number;
}
