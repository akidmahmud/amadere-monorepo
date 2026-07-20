import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNumber, Min } from 'class-validator';

export class RecordDuePaymentDto {
  @ApiProperty({ description: 'Amount received/paid just now — added to paidAmount' })
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  amount!: number;
}
