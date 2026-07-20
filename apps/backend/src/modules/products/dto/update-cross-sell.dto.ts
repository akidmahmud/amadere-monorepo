import { ArrayUnique, IsArray, IsInt } from 'class-validator';

export class UpdateCrossSellDto {
  @IsArray()
  @ArrayUnique()
  @IsInt({ each: true })
  productIds!: number[];
}
