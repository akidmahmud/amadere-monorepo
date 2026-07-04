import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ReplyReviewDto {
  @ApiProperty()
  @IsString()
  message!: string;
}
