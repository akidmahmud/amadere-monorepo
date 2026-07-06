import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
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
