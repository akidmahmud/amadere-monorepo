import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { SuccessResponseDto } from '../../common/dto/success-response.dto';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { SetPasswordDto } from '../auth/dto/set-password.dto';
import { CustomersService } from './customers.service';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { CustomerProfileDto } from '../auth/customer.mapper';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(CustomerJwtGuard)
@Controller('customers/me')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  // Called on every page load to check login state (throttle guard runs
  // before the JWT guard, so even anonymous requests here would still
  // otherwise burn shared budget on every 401) — see SiteInfoController's
  // comment. The mutating endpoints below keep the default limit.
  @SkipThrottle()
  @Get()
  @ApiOkResponse({ type: CustomerProfileDto })
  getProfile(
    @CurrentCustomer() customer: { id: number },
  ): Promise<CustomerProfileDto> {
    return this.customers.getProfile(customer.id);
  }

  @Patch()
  @ApiOkResponse({ type: CustomerProfileDto })
  updateProfile(
    @CurrentCustomer() customer: { id: number },
    @Body() dto: UpdateProfileDto,
  ): Promise<CustomerProfileDto> {
    return this.customers.updateProfile(customer.id, dto);
  }

  @Patch('password')
  @ApiOkResponse({ type: SuccessResponseDto })
  changePassword(
    @CurrentCustomer() customer: { id: number },
    @Body() dto: ChangePasswordDto,
  ): Promise<SuccessResponseDto> {
    return this.customers.changePassword(customer.id, dto);
  }

  // POST (create), not PATCH — for an OTP-only account with no password yet.
  // See CustomersService.setPassword's comment for why this is a distinct
  // endpoint from changePassword rather than one endpoint with an optional
  // currentPassword.
  @Post('password')
  @ApiOkResponse({ type: SuccessResponseDto })
  setPassword(
    @CurrentCustomer() customer: { id: number },
    @Body() dto: SetPasswordDto,
  ): Promise<SuccessResponseDto> {
    return this.customers.setPassword(customer.id, dto);
  }
}
