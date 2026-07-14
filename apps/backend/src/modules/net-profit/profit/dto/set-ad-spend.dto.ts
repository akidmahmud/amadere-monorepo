import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class SetAdSpendDto {
  @ApiProperty()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  adSpend!: number;
}
