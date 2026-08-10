import { ApiProperty } from '@nestjs/swagger';
import { IsInt } from 'class-validator';

export class AddSubscriberTagDto {
  @ApiProperty()
  @IsInt()
  tagId!: number;
}
