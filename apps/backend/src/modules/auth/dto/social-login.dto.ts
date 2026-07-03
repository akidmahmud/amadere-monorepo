import { ApiProperty } from '@nestjs/swagger';
import { SocialProvider } from '@amader/db';
import { IsEnum, IsString } from 'class-validator';

export class SocialLoginDto {
  @ApiProperty({ enum: SocialProvider })
  @IsEnum(SocialProvider)
  provider!: SocialProvider;

  @ApiProperty()
  @IsString()
  accessToken!: string;
}
