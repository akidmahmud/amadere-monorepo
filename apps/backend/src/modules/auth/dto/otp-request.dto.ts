import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class OtpRequestDto {
  @ApiProperty({ description: 'Phone number or email' })
  @IsString()
  identifier!: string;

  @ApiProperty({ enum: ['REGISTER', 'LOGIN', 'RESET_PASSWORD'] })
  @IsIn(['REGISTER', 'LOGIN', 'RESET_PASSWORD'])
  purpose!: 'REGISTER' | 'LOGIN' | 'RESET_PASSWORD';
}
