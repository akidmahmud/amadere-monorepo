import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OrderStatus } from '@amader/db';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

/** One line of a delivered order coming back. */
export class ReturnLineDto {
  @ApiProperty() @IsInt() itemId!: number;
  /** Units going back on the shelf. */
  @ApiProperty() @IsInt() @Min(0) restock!: number;
  /** Units damaged and written off (never restocked). */
  @ApiProperty() @IsInt() @Min(0) writeOff!: number;
}

export class UpdateOrderStatusDto {
  @ApiProperty({ enum: OrderStatus })
  @IsEnum(OrderStatus)
  status!: OrderStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  /** Delivered order returned: per line, how many go back to stock and
   *  how many are written off. Omitted = everything back to stock. */
  @ApiPropertyOptional({ type: [ReturnLineDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReturnLineDto)
  returnLines?: ReturnLineDto[];
}
