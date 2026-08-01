import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import type { InvoiceDateFormat, InvoiceLanguageSupport } from '../invoice-settings.service';

const DATE_FORMATS: InvoiceDateFormat[] = ['MDY', 'DMY', 'YMD'];
const LANGUAGE_SUPPORT: InvoiceLanguageSupport[] = ['default', 'arabic', 'bengali', 'chinese'];

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
  @MaxLength(100)
  companyCity?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyState?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  companyCountry?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20)
  companyZipcode?: string;

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

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  customFontEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  customFontFamily?: string;

  @ApiPropertyOptional({ enum: LANGUAGE_SUPPORT })
  @IsOptional()
  @IsIn(LANGUAGE_SUPPORT)
  languageSupport?: InvoiceLanguageSupport;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  termsAndConditions?: string;
}
