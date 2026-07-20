import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateWhatsappSettingsDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional({ description: 'International format without a leading +, e.g. 8801XXXXXXXXX' })
  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @ApiPropertyOptional({ description: 'Sent from the product page WhatsApp button — supports {{productName}}' })
  @IsOptional()
  @IsString()
  productMessageTemplate?: string;

  @ApiPropertyOptional({ description: 'Sent from the site-wide floating WhatsApp button' })
  @IsOptional()
  @IsString()
  floatingMessageTemplate?: string;
}
