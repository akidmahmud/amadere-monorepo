import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsBoolean, IsOptional, IsString } from 'class-validator';

export class UpdateSmsTemplateDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  bodyBn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
