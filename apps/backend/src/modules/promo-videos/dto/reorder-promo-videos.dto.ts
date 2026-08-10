import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

// Same trick as ReorderHomepageSectionsDto — array position becomes the new
// sortOrder, matching what the admin drag-and-drop list already produces.
export class ReorderPromoVideosDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  ids!: number[];
}
