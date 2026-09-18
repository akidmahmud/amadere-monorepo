import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CostPriceUnit } from '@amader/db';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsNumber,
  IsOptional,
  Matches,
  Min,
} from 'class-validator';

export class AddCostDto {
  @ApiProperty() @IsInt() productId!: number;
  @ApiPropertyOptional({ nullable: true }) @IsOptional() @IsInt() variantId?:
    number | null;
  @ApiProperty() @IsNumber() @Min(0) cost!: number;
  @ApiPropertyOptional({ enum: CostPriceUnit, nullable: true })
  @IsOptional()
  @IsEnum(CostPriceUnit)
  costPriceUnit?: CostPriceUnit | null;
  @ApiPropertyOptional({
    description: 'YYYY-MM-DD (Asia/Dhaka); default today',
  })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  effectiveFrom?: string;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() confirmed?: boolean;
}

export class ConfirmCostDto {
  @ApiProperty() @IsBoolean() confirmed!: boolean;
}
