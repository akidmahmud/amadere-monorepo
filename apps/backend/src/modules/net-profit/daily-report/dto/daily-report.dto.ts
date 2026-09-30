import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class GenerateDailyReportDto {
  // Trimming/emptiness is checked in period.validateManual so the message is friendly.
  @ApiProperty() @IsString() @MaxLength(200) name!: string;
  @ApiProperty({ description: 'YYYY-MM-DD, Asia/Dhaka' })
  @Matches(DAY)
  from!: string;
  @ApiProperty({ description: 'YYYY-MM-DD, Asia/Dhaka' })
  @Matches(DAY)
  to!: string;
}

export class ListDailyReportsDto {
  @ApiPropertyOptional({ description: 'Reports whose period covers this day' })
  @IsOptional()
  @Matches(DAY)
  date?: string;
  @ApiPropertyOptional({ description: 'Name contains (case-insensitive)' })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  pageSize?: number;
}
