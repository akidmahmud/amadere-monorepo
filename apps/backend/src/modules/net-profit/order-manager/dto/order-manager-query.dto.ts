import { ApiPropertyOptional } from '@nestjs/swagger';
import { CourierProviderName, OrderChannel, OrderStatus, PaymentProvider, RiskLevel } from '@amader/db';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export const ORDER_MANAGER_MAX_PAGE_SIZE = 20000;

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

  @ApiPropertyOptional({ enum: OrderStatus })
  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @ApiPropertyOptional({ enum: PaymentProvider })
  @IsOptional()
  @IsEnum(PaymentProvider)
  paymentProvider?: PaymentProvider;

  @ApiPropertyOptional({ enum: CourierProviderName })
  @IsOptional()
  @IsEnum(CourierProviderName)
  courierProvider?: CourierProviderName;

  @ApiPropertyOptional({ enum: RiskLevel })
  @IsOptional()
  @IsEnum(RiskLevel)
  risk?: RiskLevel;

  @ApiPropertyOptional({ description: 'Shipping address division, e.g. "Dhaka"' })
  @IsOptional()
  @IsString()
  division?: string;

  @ApiPropertyOptional({ enum: OrderChannel, description: 'Order.channel — the Origin column' })
  @IsOptional()
  @IsEnum(OrderChannel)
  channel?: OrderChannel;

  @ApiPropertyOptional({
    description:
      'utm_source. Matches the way the Source column DISPLAYS the value, not ' +
      'the raw string: "facebook" also finds fb / FB / facebook.com / ' +
      'm.facebook.com but never the paid markers, and "fbads" finds fbads / ' +
      'fb-ads / fb_ads / facebook-ads / facebookads. "none" finds orders with ' +
      'no source recorded. Anything else is an exact, case-insensitive match.',
  })
  @IsOptional()
  @IsString()
  utmSource?: string;

  @ApiPropertyOptional({
    description:
      'Filter by the staff member an order is assigned to. Pass an admin id, ' +
      'or the literal "none" for orders nobody has picked up yet.',
  })
  @IsOptional()
  @IsString()
  assignedAdminId?: string;

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
