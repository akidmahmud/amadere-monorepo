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
const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export class GenerateDailyReportDto {
  // Trimming/emptiness is checked in period.validateManual so the message is friendly.
  @ApiProperty() @IsString() @MaxLength(200) name!: string;
  @ApiProperty({ description: 'YYYY-MM-DD, Asia/Dhaka' })
  @Matches(DAY)
  from!: string;
  @ApiProperty({ description: 'YYYY-MM-DD, Asia/Dhaka' })
  @Matches(DAY)
  to!: string;
  /** Optional exact times (HH:MM, Dhaka). Set -> the report covers from-date
   *  fromTime up to and including the to-date toTime minute, instead of
   *  8 PM business days. */
  @ApiPropertyOptional({ description: 'HH:MM, Asia/Dhaka' })
  @IsOptional()
  @Matches(TIME)
  fromTime?: string;
  @ApiPropertyOptional({ description: 'HH:MM, Asia/Dhaka (inclusive minute)' })
  @IsOptional()
  @Matches(TIME)
  toTime?: string;
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
