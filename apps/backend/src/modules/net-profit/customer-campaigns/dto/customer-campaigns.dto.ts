import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class UpsertCustomerCampaignTemplateDto {
  // WEB_PUSH is deliberately absent: a push subscription belongs to a
  // browser, and a customer who was just added by an admin has no browser
  // attached to them. Email and SMS are the only channels this trigger can
  // actually reach.
  @ApiProperty({ enum: ['EMAIL', 'SMS'] })
  @IsIn(['EMAIL', 'SMS'])
  channel!: 'EMAIL' | 'SMS';

  @ApiProperty()
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiPropertyOptional({ description: 'Email only; ignored for SMS' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject?: string;

  @ApiProperty({ description: 'Supports {{name}} and {{first_name}}' })
  @IsString()
  @MaxLength(5000)
  bodyEn!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(5000)
  bodyBn!: string;

  @ApiPropertyOptional({ description: 'Rich HTML body for email. Plain body is still sent as the text alternative.' })
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  bodyHtmlEn?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100_000)
  bodyHtmlBn?: string;

  @ApiPropertyOptional({ enum: ['CUSTOMER_ADDED', 'RECURRING'], default: 'CUSTOMER_ADDED' })
  @IsOptional()
  @IsIn(['CUSTOMER_ADDED', 'RECURRING'])
  trigger?: 'CUSTOMER_ADDED' | 'RECURRING';

  @ApiPropertyOptional({ enum: ['ALL', 'NO_ORDER_IN_DAYS'], default: 'ALL' })
  @IsOptional()
  @IsIn(['ALL', 'NO_ORDER_IN_DAYS'])
  audience?: 'ALL' | 'NO_ORDER_IN_DAYS';

  @ApiPropertyOptional({ description: 'For NO_ORDER_IN_DAYS' })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  audienceDays?: number;

  @ApiPropertyOptional({
    description: 'RECURRING only. Never message the same customer again inside this many days.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(3650)
  repeatEveryDays?: number;

  @ApiProperty({ description: 'How long after the customer was added. 0 = immediately.' })
  @IsInt()
  @Min(0)
  // A year in minutes. Not a real limit, just a guard against a typo
  // scheduling a send past the heat death of the universe.
  @Max(525_600)
  delayValue!: number;

  @ApiProperty({ enum: ['MINUTE', 'HOUR', 'DAY'] })
  @IsIn(['MINUTE', 'HOUR', 'DAY'])
  delayUnit!: 'MINUTE' | 'HOUR' | 'DAY';

  @ApiPropertyOptional({ enum: ['ACTIVE', 'PAUSED'] })
  @IsOptional()
  @IsIn(['ACTIVE', 'PAUSED'])
  status?: 'ACTIVE' | 'PAUSED';
}

export class UpdateCustomerCampaignSettingsDto {
  @ApiPropertyOptional({ description: 'Master switch. Off means nothing is queued and nothing is sent.' })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  maxAttempts?: number;

  @ApiPropertyOptional({ description: 'Local hour, 0-23. Nothing sends between start and end.' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  quietHoursStart?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(23)
  quietHoursEnd?: number;

  @ApiPropertyOptional({
    description: 'Cap on how many customers one recurring scan may enrol, so a first run cannot blast the whole list.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10_000)
  recurringBatchSize?: number;
}
