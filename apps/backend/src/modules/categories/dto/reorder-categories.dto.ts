import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsInt } from 'class-validator';

export class ReorderCategoriesDto {
  @ApiProperty({
    type: [Number],
    description:
      'Category ids in their new display order. Ranks are assigned per parent group, so dragging reorders siblings and never reparents a category — use the parent picker on the edit form for that.',
  })
  @IsArray()
  @ArrayNotEmpty()
  @IsInt({ each: true })
  ids!: number[];
}
