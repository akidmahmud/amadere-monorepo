import { ArrayUnique, IsArray, IsInt } from 'class-validator';

// The ORDER of `productIds` is the display order — position is derived from
// the array index rather than sent per row, so the admin's drag-to-reorder
// list and the payload are the same thing. Same shape as UpdateCrossSellDto
// otherwise; kept separate so the two can diverge without a shared-DTO edit
// silently changing cross-sell's contract.
export class UpdateRelatedProductsDto {
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  productIds!: number[];
}
