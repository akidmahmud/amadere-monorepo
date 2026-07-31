import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { InvoiceDateFormat } from '../invoice-settings.service';

const DATE_FORMATS: InvoiceDateFormat[] = ['MDY', 'DMY', 'YMD'];

export class UpdateInvoiceSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  companyAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(200)
  companyEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(50)
  companyPhone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyTaxId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  companyLogoUrl?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  invoicePrefix?: string;

  @ApiPropertyOptional({ enum: DATE_FORMATS })
  @IsOptional()
  @IsIn(DATE_FORMATS)
  dateFormat?: InvoiceDateFormat;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  disableUntilConfirmed?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  stampEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  stampImageUrl?: string;
}
