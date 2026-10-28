import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CallOutcome } from '@amader/db';
import { IsEnum, IsOptional, IsString, Matches } from 'class-validator';

export class CreateCustomerCallLogDto {
  @ApiProperty({ enum: CallOutcome })
  @IsEnum(CallOutcome)
  outcome!: CallOutcome;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;

  @ApiPropertyOptional({ description: 'YYYY-MM-DD: sets the Next call target' })
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  nextCallTarget?: string;
}
