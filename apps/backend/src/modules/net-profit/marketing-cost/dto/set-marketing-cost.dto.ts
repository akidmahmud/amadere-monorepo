import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, Min } from 'class-validator';

export class SetMarketingCostDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  adsCost!: number;

  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  otherCost!: number;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
