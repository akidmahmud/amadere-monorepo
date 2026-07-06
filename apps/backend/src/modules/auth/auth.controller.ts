import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { TokenPair } from '../../common/auth/token.types';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { CustomerAuthService } from './customer-auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { OtpRequestDto } from './dto/otp-request.dto';
import { OtpVerifyDto } from './dto/otp-verify.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { SocialLoginDto } from './dto/social-login.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { CustomerProfileDto } from './customer.mapper';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly customerAuth: CustomerAuthService) {}

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('register')
  @ApiOkResponse({ type: TokenPair })
  register(@Body() dto: RegisterDto): Promise<TokenPair> {
    return this.customerAuth.register(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('login')
  @ApiOkResponse({ type: TokenPair })
  login(@Body() dto: LoginDto): Promise<TokenPair> {
    return this.customerAuth.login(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('otp/request')
  requestOtp(@Body() dto: OtpRequestDto): Promise<void> {
    return this.customerAuth.requestOtp(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('otp/verify')
  @ApiOkResponse({ type: TokenPair })
  verifyOtp(@Body() dto: OtpVerifyDto): Promise<TokenPair> {
    return this.customerAuth.verifyOtp(dto);
  }

  @Post('social-login')
  @ApiOkResponse({ type: TokenPair })
  socialLogin(@Body() dto: SocialLoginDto): Promise<TokenPair> {
    return this.customerAuth.socialLogin(dto);
  }

  @Post('refresh')
  @ApiOkResponse({ type: TokenPair })
  refresh(@Body() dto: RefreshTokenDto): Promise<TokenPair> {
    return this.customerAuth.refresh(dto.refreshToken);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('password/forgot')
  forgotPassword(@Body() dto: ForgotPasswordDto): Promise<void> {
    return this.customerAuth.forgotPassword(dto);
  }

  @Throttle({ default: { limit: 5, ttl: 60000 } })
  @Post('password/reset')
  resetPassword(@Body() dto: ResetPasswordDto): Promise<void> {
    return this.customerAuth.resetPassword(dto);
  }

  @ApiBearerAuth()
  @UseGuards(CustomerJwtGuard)
  @Get('me')
  @ApiOkResponse({ type: CustomerProfileDto })
  me(@CurrentCustomer() customer: { id: number }): Promise<CustomerProfileDto> {
    return this.customerAuth.me(customer.id);
  }
}
