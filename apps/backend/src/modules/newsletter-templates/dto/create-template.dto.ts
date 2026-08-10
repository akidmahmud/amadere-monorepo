import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsIn, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import type { EmailContentMode } from '../../../common/newsletter/email-renderer.util';
import { EmailBlockDto } from '../../newsletter-campaigns/dto/email-block.dto';

const CONTENT_MODES: EmailContentMode[] = ['blocks', 'html'];

export class CreateTemplateDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ type: [EmailBlockDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmailBlockDto)
  blocks?: EmailBlockDto[];

  @ApiPropertyOptional({ enum: CONTENT_MODES, description: 'Defaults to "blocks"' })
  @IsOptional()
  @IsIn(CONTENT_MODES)
  mode?: EmailContentMode;

  @ApiPropertyOptional({ description: 'Full HTML design, used when mode = "html". Sanitized on save.' })
  @IsOptional()
  @IsString()
  @MaxLength(300_000)
  html?: string;
}
