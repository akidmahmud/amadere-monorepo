import { ApiPropertyOptional } from '@nestjs/swagger';
import { CourierProviderName, OrderStatus, PaymentProvider, RiskLevel } from '@amader/db';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../../../../common/dto/pagination-query.dto';

export class OrderManagerQueryDto extends PaginationQueryDto {
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
