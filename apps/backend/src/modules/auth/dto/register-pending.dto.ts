import { ApiProperty } from '@nestjs/swagger';

// register() no longer signs the customer in directly — the account only
// becomes real once the phone OTP is verified (POST /auth/otp/verify,
// purpose=REGISTER), which is what actually returns a TokenPair.
export class RegisterPendingDto {
  @ApiProperty({ enum: [true] })
  pending!: true;
}
