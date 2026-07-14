import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TestSendSmsDto {
  @ApiProperty()
  @IsString()
  to!: string;

  @ApiProperty()
  @IsString()
  body!: string;
}
