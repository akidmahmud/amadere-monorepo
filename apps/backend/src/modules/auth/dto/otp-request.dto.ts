import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsString } from 'class-validator';

export class OtpRequestDto {
  @ApiProperty({ description: 'Phone number or email' })
  @IsString()
  identifier!: string;

  @ApiProperty({ enum: ['REGISTER', 'LOGIN'] })
  @IsIn(['REGISTER', 'LOGIN'])
  purpose!: 'REGISTER' | 'LOGIN';
}
