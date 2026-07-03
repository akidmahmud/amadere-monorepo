import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @ApiProperty({ description: 'Phone number or email' })
  @IsString()
  identifier!: string;

  @ApiProperty()
  @IsString()
  code!: string;

  @ApiProperty()
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
