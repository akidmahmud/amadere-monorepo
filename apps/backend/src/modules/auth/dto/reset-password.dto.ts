import { ApiProperty } from '@nestjs/swagger';
import { IsString, MinLength } from 'class-validator';

// Completes the "I forgot my password" flow: prove ownership of the
// identifier with a RESET_PASSWORD OTP, then set a new password. Deliberately
// NOT reachable through /customers/password — that pair needs either the
// current password (changePassword) or no password at all (setPassword), so
// neither can help someone who has a password and cannot remember it.
export class ResetPasswordDto {
  @ApiProperty({ description: 'Phone number or email' })
  @IsString()
  identifier!: string;

  @ApiProperty({ description: 'The 6-digit RESET_PASSWORD OTP' })
  @IsString()
  code!: string;

  @ApiProperty({ minLength: 8 })
  @IsString()
  @MinLength(8)
  newPassword!: string;
}
