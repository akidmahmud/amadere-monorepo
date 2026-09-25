import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class PosCouponDto {
  @ApiProperty({ example: 'STORE10' }) @IsString() code!: string;
  @ApiProperty({ enum: ['PERCENTAGE', 'FIXED_AMOUNT'] })
  @IsIn(['PERCENTAGE', 'FIXED_AMOUNT'])
  valueType!: 'PERCENTAGE' | 'FIXED_AMOUNT';
  @ApiProperty() @IsNumber() @Min(0) value!: number;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minOrderAmount?: number | null;
  @ApiPropertyOptional({ nullable: true, description: 'null = every store' })
  @IsOptional()
  @IsInt()
  storeId?: number | null;
  @ApiPropertyOptional({ nullable: true, example: '2026-10-01' })
  @IsOptional()
  @IsString()
  startsAt?: string | null;
  @ApiPropertyOptional({ nullable: true, example: '2026-10-31' })
  @IsOptional()
  @IsString()
  endsAt?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesTotal?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsesPerCustomer?: number | null;
  @ApiProperty() @IsBoolean() active!: boolean;
}
