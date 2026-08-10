import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class CreateNewsletterTagDto {
  @ApiProperty()
  @IsString()
  name!: string;
}
