import { ApiProperty } from '@nestjs/swagger';

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
  @ApiProperty() totalRevenue!: string;
  @ApiProperty() totalOrders!: number;
  @ApiProperty() totalCustomers!: number;
  @ApiProperty() totalProducts!: number;
  @ApiProperty() completedOrderRate!: number;
  @ApiProperty() avgOrderValue!: string;
  @ApiProperty({ type: PeriodStatsDto }) today!: PeriodStatsDto;
  @ApiProperty({ type: PeriodStatsDto }) completed!: PeriodStatsDto;
  @ApiProperty({ type: PeriodStatsDto }) pending!: PeriodStatsDto;
  @ApiProperty({ type: [OrderStatusCountDto] }) statusBreakdown!: OrderStatusCountDto[];
  @ApiProperty({ type: [OrderChannelCountDto] }) ordersByChannel!: OrderChannelCountDto[];
  @ApiProperty({ type: [RecentOrderDto] }) recentOrders!: RecentOrderDto[];
  @ApiProperty({ type: [TopCustomerDto] }) topCustomers!: TopCustomerDto[];
  @ApiProperty({ type: [MonthlyRevenuePointDto] }) monthlyRevenue!: MonthlyRevenuePointDto[];
  @ApiProperty({ type: [TopProductDto] }) topProducts!: TopProductDto[];
}
