import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class UpdateMarketingCostSettingsDto {
  @ApiPropertyOptional({ description: 'Copy the previous day\'s marketing cost forward when a new day has no entry yet' })
  @IsOptional()
  @IsBoolean()
  autoCarryEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Ads cost (৳) assumed for a day with no marketing cost entry and no prior day to carry forward' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  defaultMarketingCost?: number;

  @ApiPropertyOptional({ description: 'Email a CSV sales report for the previous day, every day at midnight' })
  @IsOptional()
  @IsBoolean()
  autoReportEnabled?: boolean;

  @ApiPropertyOptional({ description: 'Leave blank to skip sending even when autoReportEnabled is on' })
  @IsOptional()
  @IsString()
  reportEmail?: string;
}
