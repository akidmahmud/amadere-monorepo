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
}
