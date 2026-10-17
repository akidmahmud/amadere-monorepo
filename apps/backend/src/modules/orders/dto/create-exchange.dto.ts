import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsInt,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';

export class ExchangeLineDto {
  /** A line of the original order. */
  @ApiProperty() @IsInt() itemId!: number;
  /** How many to replace: at most the line's quantity. */
  @ApiProperty() @IsInt() @IsPositive() quantity!: number;
}

export class CreateExchangeDto {
  @ApiProperty({ type: [ExchangeLineDto] })
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => ExchangeLineDto)
  items!: ExchangeLineDto[];

  /** Why (e.g. "turmeric smelled bad"); goes into the staff note. */
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300)
  reason?: string;
}
