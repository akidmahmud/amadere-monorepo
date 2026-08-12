import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class OrderStatusCountDto {
  @ApiProperty() status!: string;
  @ApiProperty() count!: number;
}

export class RecentOrderDto {
  @ApiProperty() id!: number;
  @ApiProperty() orderNumber!: string;
  @ApiProperty() customerName!: string;
  @ApiProperty() total!: string;
  @ApiProperty() status!: string;
  @ApiProperty() createdAt!: string;
  @ApiProperty({ enum: ['COD', 'PAID'] }) paymentMethod!: 'COD' | 'PAID';
}

export class MonthlyRevenuePointDto {
  @ApiProperty() label!: string;
  @ApiProperty() revenue!: string;
  @ApiProperty() previousRevenue!: string;
}

export class TopProductDto {
  @ApiProperty() id!: number;
  @ApiProperty() slug!: string;
  @ApiProperty() name!: string;
  @ApiProperty() revenue!: string;
  @ApiProperty() unitsSold!: number;
}

export class OrderChannelCountDto {
  @ApiProperty() channel!: string;
  @ApiProperty() count!: number;
}

export class TopCustomerDto {
  @ApiProperty() id!: number;
  @ApiProperty() name!: string;
  @ApiProperty() orderCount!: number;
  @ApiProperty() totalSpend!: string;
}

export class PeriodStatsDto {
  @ApiProperty() orders!: number;
  @ApiProperty() revenue!: string;
}

export class DashboardOverviewDto {
  // 'staff' = a non-super-admin viewer — every field below except
  // recentOrders (scoped to their own assigned orders in that case) is
  // omitted, and the myAssigned* fields below are populated instead.
  @ApiProperty({ enum: ['global', 'staff'] }) scope!: 'global' | 'staff';

  @ApiPropertyOptional() totalRevenue?: string;
  @ApiPropertyOptional() totalOrders?: number;
  @ApiPropertyOptional() totalCustomers?: number;
  @ApiPropertyOptional() totalProducts?: number;
  @ApiPropertyOptional() completedOrderRate?: number;
  @ApiPropertyOptional() avgOrderValue?: string;
  @ApiPropertyOptional({ type: PeriodStatsDto }) today?: PeriodStatsDto;
  @ApiPropertyOptional({ type: PeriodStatsDto }) completed?: PeriodStatsDto;
  @ApiPropertyOptional({ type: PeriodStatsDto }) pending?: PeriodStatsDto;
  @ApiPropertyOptional({ type: [OrderStatusCountDto] }) statusBreakdown?: OrderStatusCountDto[];
  @ApiPropertyOptional({ type: [OrderChannelCountDto] }) ordersByChannel?: OrderChannelCountDto[];
  @ApiPropertyOptional({ type: [TopCustomerDto] }) topCustomers?: TopCustomerDto[];
  @ApiPropertyOptional({ type: [MonthlyRevenuePointDto] }) monthlyRevenue?: MonthlyRevenuePointDto[];
  @ApiPropertyOptional({ type: [TopProductDto] }) topProducts?: TopProductDto[];

  // recentOrders: global top-5 for scope=global, this admin's own assigned
  // orders for scope=staff — always populated, either way.
  @ApiProperty({ type: [RecentOrderDto] }) recentOrders!: RecentOrderDto[];

  // Staff-only (scope=staff) — no revenue figures, just what a staff member
  // needs to know about their own workload.
  @ApiPropertyOptional() myAssignedOrdersTotal?: number;
  @ApiPropertyOptional() myAssignedOrdersToday?: number;
  @ApiPropertyOptional({ type: [OrderStatusCountDto] }) myAssignedOrdersByStatus?: OrderStatusCountDto[];
  @ApiPropertyOptional() myAssignedCustomersTotal?: number;
}
