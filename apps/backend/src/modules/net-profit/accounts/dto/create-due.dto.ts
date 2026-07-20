import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { DuePartyType } from '@amader/db';
import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class CreateDueDto {
  @ApiProperty({ enum: DuePartyType })
  @IsEnum(DuePartyType)
  partyType!: DuePartyType;

  @ApiProperty()
  @IsString()
  partyName!: string;

  @ApiPropertyOptional({ description: 'Link to a real Customer record when partyType=CUSTOMER' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  customerId?: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  amount!: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  note?: string;
}
