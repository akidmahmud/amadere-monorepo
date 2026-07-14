import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';

export const SALES_GROUP_BY = ['day', 'week', 'month', 'hour', 'courier', 'area', 'payment'] as const;
export type SalesGroupBy = (typeof SALES_GROUP_BY)[number];

export class SalesReportQueryDto {
  @ApiPropertyOptional({ enum: SALES_GROUP_BY, default: 'day' })
  @IsOptional()
  @IsIn(SALES_GROUP_BY)
  groupBy?: SalesGroupBy;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  to?: string;
}
