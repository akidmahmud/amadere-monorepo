import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CallOutcome } from '@amader/db';
import { IsEnum, IsOptional, IsString } from 'class-validator';

export class CreateCustomerCallLogDto {
  @ApiProperty({ enum: CallOutcome })
  @IsEnum(CallOutcome)
  outcome!: CallOutcome;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}
