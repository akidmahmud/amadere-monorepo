import { ApiPropertyOptional } from '@nestjs/swagger';
import { CustomerCrmStatus, CustomerPriority } from '@amader/db';
import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsDateString, IsEnum, IsInt, IsOptional, IsString } from 'class-validator';

export class AdminCustomerQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  q?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  tierId?: number;

  @ApiPropertyOptional({ description: 'CustomerAddress.district of the customer\'s default (or first) address' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional({ enum: CustomerPriority })
  @IsOptional()
  @IsEnum(CustomerPriority)
  priority?: CustomerPriority;

  @ApiPropertyOptional({ enum: CustomerCrmStatus })
  @IsOptional()
  @IsEnum(CustomerCrmStatus)
  crmStatus?: CustomerCrmStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  assignedAdminId?: number;

  @ApiPropertyOptional({ description: "Only customers whose birthday (month+day, any year) is today" })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  birthdayToday?: boolean;

  @ApiPropertyOptional({ description: 'Only customers created on or after this date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  createdFrom?: string;

  @ApiPropertyOptional({ description: 'Only customers created on or before this date (YYYY-MM-DD)' })
  @IsOptional()
  @IsDateString()
  createdTo?: string;

  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @ApiPropertyOptional({ default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  pageSize?: number;
}
