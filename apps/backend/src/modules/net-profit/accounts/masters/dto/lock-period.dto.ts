import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class LockPeriodDto {
  @ApiProperty({ description: 'Any date inside the month to lock; normalised to the 1st' })
  @IsDateString()
  month!: string;

  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
}
