import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { BlockType } from '@amader/db';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateBlockRuleDto {
  @ApiProperty({ enum: BlockType })
  @IsEnum(BlockType)
  type!: BlockType;

  @ApiProperty()
  @IsString()
  value!: string;

  @ApiPropertyOptional({ description: 'Free-text category, e.g. "fraud" | "fake_order" | "repeated_return"' })
  @IsOptional()
  @IsString()
  category?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  addressText?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;

  @ApiPropertyOptional({ description: 'ISO date — omit for a permanent block' })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;
}
