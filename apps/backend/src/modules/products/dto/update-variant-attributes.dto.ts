import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

export class UpdateVariantAttributesDto {
  /** The variant's new option per axis, e.g. [id of "250 gram"]. */
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  attributeValueIds!: number[];
}
