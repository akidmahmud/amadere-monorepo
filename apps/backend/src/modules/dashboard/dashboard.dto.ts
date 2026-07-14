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

export class DashboardOverviewDto {
  @ApiProperty() totalRevenue!: string;
  @ApiProperty() totalOrders!: number;
  @ApiProperty() totalCustomers!: number;
  @ApiProperty() completedOrderRate!: number;
  @ApiProperty({ type: [OrderStatusCountDto] }) statusBreakdown!: OrderStatusCountDto[];
  @ApiProperty({ type: [RecentOrderDto] }) recentOrders!: RecentOrderDto[];
  @ApiProperty({ type: [MonthlyRevenuePointDto] }) monthlyRevenue!: MonthlyRevenuePointDto[];
  @ApiProperty({ type: [TopProductDto] }) topProducts!: TopProductDto[];
}
