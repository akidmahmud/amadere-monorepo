import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsEmail, IsIn, IsInt, IsOptional, IsString, MaxLength, ValidateNested } from 'class-validator';
import type { EmailContentMode } from '../../../common/newsletter/email-renderer.util';
import { EmailBlockDto } from './email-block.dto';

const CONTENT_MODES: EmailContentMode[] = ['blocks', 'html'];

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  name!: string;

  @ApiProperty()
  @IsString()
  subject!: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  previewText?: string;

  @ApiPropertyOptional({ description: 'Falls back to Settings > Email sender identity when unset' })
  @IsOptional()
  @IsString()
  fromName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  fromEmail?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  replyTo?: string;

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

  // number = target that segment; null = explicitly clear back to "all
  // subscribed subscribers"; omitted = leave unchanged (update only).
  // @IsOptional() treats both undefined AND null as "skip validation" (per
  // class-validator's own docs), so all three states pass through intact
  // rather than null getting coerced away before it reaches Prisma.
  @ApiPropertyOptional({ description: 'Audience segment id, or null for all subscribed subscribers' })
  @IsOptional()
  @IsInt()
  segmentId?: number | null;
}

export class SendTestCampaignDto {
  @ApiProperty()
  @IsEmail()
  email!: string;
}

export class ScheduleCampaignDto {
  @ApiProperty({ description: 'ISO datetime, must be in the future' })
  @IsString()
  scheduledAt!: string;
}

// Stateless render — used to preview unsaved content (New Campaign / New
// Template forms don't have an id yet) as well as saved ones.
export class PreviewContentDto {
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

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(300_000)
  html?: string;
}
