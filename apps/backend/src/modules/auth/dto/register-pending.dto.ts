import { ApiProperty } from '@nestjs/swagger';

// register() no longer signs the customer in directly — the account only
// becomes real once the phone OTP is verified (POST /auth/otp/verify,
// purpose=REGISTER), which is what actually returns a TokenPair.
export class RegisterPendingDto {
  @ApiProperty({ enum: [true] })
  pending!: true;

  // The verify step has to submit the SAME identifier the code was stored
  // under (OtpService keys on it), so the client can't just assume "phone".
  // Returned rather than re-derived client-side so there is one source of
  // truth for where the code actually went.
  @ApiProperty({ enum: ['PHONE', 'EMAIL'] })
  otpChannel!: 'PHONE' | 'EMAIL';

  @ApiProperty({ description: 'The phone or email the code was sent to — echo this back to /auth/otp/verify.' })
  otpIdentifier!: string;
}
