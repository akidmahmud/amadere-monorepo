import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { SuccessResponseDto } from '../../common/dto/success-response.dto';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
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
}
