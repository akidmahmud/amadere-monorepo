import { ApiProperty } from '@nestjs/swagger';
import { ArrayMinSize, IsArray, IsInt } from 'class-validator';

// The array's position becomes the new sortOrder — no separate sortOrder
// values needed on the wire, the same trick the admin drag-and-drop UI
// already produces naturally.
export class ReorderHomepageSectionsDto {
  @ApiProperty({ type: [Number] })
  @IsArray()
  @ArrayMinSize(1)
  @IsInt({ each: true })
  ids!: number[];
}
