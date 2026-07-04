import { Body, Controller, Get, Patch, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { ChangePasswordDto } from '../auth/dto/change-password.dto';
import { CustomersService } from './customers.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(CustomerJwtGuard)
@Controller('customers/me')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  getProfile(@CurrentCustomer() customer: { id: number }) {
    return this.customers.getProfile(customer.id);
  }

  @Patch()
  updateProfile(
    @CurrentCustomer() customer: { id: number },
    @Body() dto: UpdateProfileDto,
  ) {
    return this.customers.updateProfile(customer.id, dto);
  }

  @Patch('password')
  changePassword(
    @CurrentCustomer() customer: { id: number },
    @Body() dto: ChangePasswordDto,
  ) {
    return this.customers.changePassword(customer.id, dto);
  }
}
