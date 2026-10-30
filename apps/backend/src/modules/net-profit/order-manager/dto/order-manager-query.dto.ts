import { ApiPropertyOptional } from '@nestjs/swagger';
import { CourierProviderName, OrderChannel, OrderStatus, PaymentProvider, RiskLevel } from '@amader/db';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export const ORDER_MANAGER_MAX_PAGE_SIZE = 20000;

/** Multi-select filters arrive as "a,b,c"; an array already is one. */
const csv = ({ value }: { value: unknown }) =>
  typeof value === 'string'
    ? value.split(',').map((v) => v.trim()).filter(Boolean)
    : value;

export class OrderManagerQueryDto extends PaginationQueryDto {
  // Larger than the site-wide 100 so staff can pick "All" on one page.
  // ponytail: one capped query; switch to virtual scrolling if All gets slow.
  @ApiPropertyOptional({ default: 20, maximum: ORDER_MANAGER_MAX_PAGE_SIZE })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(ORDER_MANAGER_MAX_PAGE_SIZE)
  declare pageSize?: number;

  @ApiPropertyOptional({ enum: OrderStatus, description: 'Comma-separated for several' })
  @IsOptional()
  @Transform(csv)
  @IsEnum(OrderStatus, { each: true })
  status?: OrderStatus[];

  /** true = only Exchange orders (linked to an original), any status. */
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  exchange?: boolean;

  @ApiPropertyOptional({ enum: PaymentProvider, description: 'Comma-separated for several' })
  @IsOptional()
  @Transform(csv)
  @IsEnum(PaymentProvider, { each: true })
  paymentProvider?: PaymentProvider[];

  @ApiPropertyOptional({ enum: CourierProviderName, description: 'Comma-separated for several' })
  @IsOptional()
  @Transform(csv)
  @IsEnum(CourierProviderName, { each: true })
  courierProvider?: CourierProviderName[];

  @ApiPropertyOptional({ enum: RiskLevel, description: 'Comma-separated for several' })
  @IsOptional()
  @Transform(csv)
  @IsEnum(RiskLevel, { each: true })
  risk?: RiskLevel[];

  @ApiPropertyOptional({ description: 'Shipping address division, e.g. "Dhaka"' })
  @IsOptional()
  @IsString()
  division?: string;

  @ApiPropertyOptional({ enum: OrderChannel, description: 'Order.channel — the Origin column; comma-separated for several' })
  @IsOptional()
  @Transform(csv)
  @IsEnum(OrderChannel, { each: true })
  channel?: OrderChannel[];

  @ApiPropertyOptional({
    description:
      'utm_source. Matches the way the Source column DISPLAYS the value, not ' +
      'the raw string: "facebook" also finds fb / FB / facebook.com / ' +
      'm.facebook.com but never the paid markers, and "fbads" finds fbads / ' +
      'fb-ads / fb_ads / facebook-ads / facebookads. "none" finds orders with ' +
      'no source recorded. Anything else is an exact, case-insensitive match. ' +
      'Comma-separated for several (any of them).',
  })
  @IsOptional()
  @Transform(csv)
  @IsString({ each: true })
  utmSource?: string[];

  @ApiPropertyOptional({
    description:
      'Filter by the staff member an order is assigned to. Pass an admin id, ' +
      'or the literal "none" for orders nobody has picked up yet. ' +
      'Comma-separated for several (any of them).',
  })
  @IsOptional()
  @Transform(csv)
  @IsString({ each: true })
  assignedAdminId?: string[];

  @ApiPropertyOptional({ description: 'Free-text search — order number, recipient name, or phone' })
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional({ description: 'ISO date — orders created on/after this instant' })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ description: 'ISO date — orders created on/before this instant' })
  @IsOptional()
  @IsString()
  to?: string;
}
