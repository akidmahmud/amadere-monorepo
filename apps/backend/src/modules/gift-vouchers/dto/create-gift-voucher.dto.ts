import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateGiftVoucherDto {
  @ApiPropertyOptional({
    description: 'Voucher code; auto-generated if omitted',
  })
  @IsOptional()
  @IsString()
  code?: string;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  initialBalance!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  purchasedByCustomerId?: number;
}
