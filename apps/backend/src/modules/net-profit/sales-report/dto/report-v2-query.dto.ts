import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Min,
} from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class ReportV2QueryDto {
  @ApiPropertyOptional({ enum: ['order', 'delivered'] })
  @IsOptional()
  @IsIn(['order', 'delivered'])
  basis: 'order' | 'delivered' = 'order';

  @ApiPropertyOptional({ description: 'YYYY-MM-DD, Asia/Dhaka' })
  @IsOptional()
  @Matches(DAY)
  from?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD, Asia/Dhaka' })
  @IsOptional()
  @Matches(DAY)
  to?: string;

  /** Optional clock times that narrow the first/last day of the range. */
  @ApiPropertyOptional({ description: 'HH:mm, Asia/Dhaka — start time on `from`' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  fromTime?: string;

  @ApiPropertyOptional({ description: 'HH:mm, Asia/Dhaka — end time on `to` (inclusive minute)' })
  @IsOptional()
  @Matches(/^([01]\d|2[0-3]):[0-5]\d$/)
  toTime?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() channel?: string;
  @ApiPropertyOptional({ description: 'Admin id, or "none" for no agent' })
  @IsOptional()
  @IsString()
  agent?: string;
  @ApiPropertyOptional({ description: 'Courier key, or "none"' })
  @IsOptional()
  @IsString()
  courier?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() district?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsIn([
    'Pending',
    'Confirmed',
    'Shipped',
    'Delivered',
    'Returned',
    'Cancelled',
  ])
  status?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional({ enum: ['newest', 'contrib', 'sales', 'over'] })
  @IsOptional()
  @IsIn(['newest', 'contrib', 'sales', 'over'])
  sort?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    description: 'Orders only: every matching row, unpaged (the Export CSV)',
  })
  @IsOptional()
  @IsIn(['true'])
  all?: 'true';
}
