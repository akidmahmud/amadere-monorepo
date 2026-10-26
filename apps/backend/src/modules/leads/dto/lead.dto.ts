import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';
import { CustomerPriority, LeadCallOutcome, LeadStatus } from '@amader/db';

const DAY = /^\d{4}-\d{2}-\d{2}$/;

export class CreateLeadDto {
  @ApiPropertyOptional() @IsString() @MaxLength(32) phone!: string;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) name?: string | null;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => !!v) @IsEmail() email?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(32) altPhone?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(300) addressLine?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) district?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) area?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(80) leadSource?: string | null;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => !!v) @Matches(DAY) leadDate?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(200) interestedProduct?: string | null;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => v !== null) @IsInt() assignedAdminId?: number | null;
  @ApiPropertyOptional({ enum: CustomerPriority })
  @IsOptional()
  @ValidateIf((_, v) => v !== null)
  @IsEnum(CustomerPriority)
  priority?: CustomerPriority | null;
  @ApiPropertyOptional({ enum: LeadStatus }) @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  @ApiPropertyOptional() @IsOptional() @ValidateIf((_, v) => !!v) @Matches(DAY) nextCallDate?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(120) lostReason?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) customerFeedback?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) agentFeedback?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) familyDetails?: string | null;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) purchaseReason?: string | null;
}

export class UpdateLeadDto extends PartialType(CreateLeadDto) {}

export class LeadQueryDto {
  @ApiPropertyOptional() @IsOptional() @IsString() q?: string;
  @ApiPropertyOptional({ enum: LeadStatus }) @IsOptional() @IsEnum(LeadStatus) status?: LeadStatus;
  /** Admin id, or "none" for unassigned. */
  @ApiPropertyOptional() @IsOptional() @IsString() assigned?: string;
  /** "due": next call date today or earlier. */
  @ApiPropertyOptional() @IsOptional() @IsIn(['due']) view?: 'due';
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) page = 1;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() @Min(1) pageSize = 20;
}

export class LogLeadCallDto {
  @ApiPropertyOptional({ enum: LeadCallOutcome }) @IsEnum(LeadCallOutcome) outcome!: LeadCallOutcome;
  @ApiPropertyOptional() @IsOptional() @IsString() @MaxLength(2000) notes?: string;
}

export class LeadDashboardQueryDto {
  @ApiPropertyOptional({ description: 'YYYY-MM-DD (Dhaka)' }) @IsOptional() @Matches(DAY) from?: string;
  @ApiPropertyOptional({ description: 'YYYY-MM-DD (Dhaka)' }) @IsOptional() @Matches(DAY) to?: string;
  @ApiPropertyOptional() @IsOptional() @Type(() => Number) @IsInt() agentId?: number;
}
