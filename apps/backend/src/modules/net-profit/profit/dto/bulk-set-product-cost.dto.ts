import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsArray, IsInt, IsNumber, Min, ValidateNested } from 'class-validator';

class BulkProductCostRowDto {
  @ApiProperty()
  @IsInt()
  productId!: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  costPerItem!: number;
}

export class BulkSetProductCostDto {
  @ApiProperty({ type: [BulkProductCostRowDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BulkProductCostRowDto)
  rows!: BulkProductCostRowDto[];
}
