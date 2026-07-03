import { ApiProperty } from '@nestjs/swagger';
import { IsString } from 'class-validator';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Phone number or email' })
  @IsString()
  identifier!: string;
}
