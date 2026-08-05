import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class CreateMediaFolderDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  name!: string;
}
