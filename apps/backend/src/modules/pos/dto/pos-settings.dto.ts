import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsNumber, Max, Min } from 'class-validator';

export class UpdatePosVatDto {
  @ApiProperty() @IsBoolean() enabled!: boolean;
  @ApiProperty({ example: 15 })
  @IsNumber()
  @Min(0)
  @Max(100)
  ratePercent!: number;
  @ApiProperty({ description: 'true = shelf prices already include VAT' })
  @IsBoolean()
  pricesIncludeVat!: boolean;
}
