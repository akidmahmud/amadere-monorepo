import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TwoFactorEnableDto {
  @ApiProperty()
  @IsString()
  code!: string;
}
