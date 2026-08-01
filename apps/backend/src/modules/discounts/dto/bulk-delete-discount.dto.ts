import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMinSize, IsInt } from 'class-validator';

export class BulkDeleteDiscountDto {
  @ApiProperty({ type: [Number] })
  @Type(() => Number)
  @IsInt({ each: true })
  @ArrayMinSize(1)
  ids!: number[];
}
