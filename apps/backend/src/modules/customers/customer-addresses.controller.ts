import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { CustomersService } from './customers.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(CustomerJwtGuard)
@Controller('customers/me/addresses')
export class CustomerAddressesController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@CurrentCustomer() customer: { id: number }) {
    return this.customers.listAddresses(customer.id);
  }

  @Post()
  create(
    @CurrentCustomer() customer: { id: number },
    @Body() dto: CreateAddressDto,
  ) {
    return this.customers.createAddress(customer.id, dto);
  }

  @Patch(':id')
  update(
    @CurrentCustomer() customer: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAddressDto,
  ) {
    return this.customers.updateAddress(customer.id, id, dto);
  }

  @Delete(':id')
  remove(
    @CurrentCustomer() customer: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ) {
    return this.customers.deleteAddress(customer.id, id);
  }
}
