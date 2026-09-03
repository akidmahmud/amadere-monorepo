import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayNotEmpty, IsArray, IsInt, Min } from 'class-validator';

export class ReorderProductsDto {
  @ApiProperty({
    type: [Number],
    description:
      'Product ids for the page being reordered, in their new order.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  ids!: number[];

  @ApiProperty({
    description:
      'Absolute index of the first id within the whole catalogue — i.e. (page - 1) * pageSize. The products list is paginated, so a page of ids alone cannot say where it sits globally.',
  })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  startPosition!: number;
}
