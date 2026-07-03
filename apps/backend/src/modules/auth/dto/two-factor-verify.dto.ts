import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class TwoFactorVerifyDto {
  @ApiProperty()
  @IsString()
  twoFactorToken!: string;

  @ApiProperty()
  @IsString()
  code!: string;
}
