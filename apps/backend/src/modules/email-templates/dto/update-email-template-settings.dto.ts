import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsInt, IsOptional, IsString, Min } from 'class-validator';

export class UpdateEmailTemplateSettingsDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsInt()
  logoMediaId?: number | null;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  contactEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  copyright?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  logoHeight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customCss?: string;
}
