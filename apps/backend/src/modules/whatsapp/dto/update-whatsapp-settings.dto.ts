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

  @ApiPropertyOptional({ description: 'Show a "Call to order" button on the product page' })
  @IsOptional()
  @IsBoolean()
  callEnabled?: boolean;

  @ApiPropertyOptional({
    description:
      'Number the product-page call button dials. Dialled as-is via tel:, so local format (01XXXXXXXXX) is fine — unlike the WhatsApp number, which must be international without a +.',
  })
  @IsOptional()
  @IsString()
  callNumber?: string;
}
