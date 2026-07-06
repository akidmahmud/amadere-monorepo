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
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { CustomerJwtGuard } from '../../common/auth/customer-jwt.guard';
import { CurrentCustomer } from '../../common/auth/current-customer.decorator';
import { SuccessResponseDto } from '../../common/dto/success-response.dto';
import { CustomersService } from './customers.service';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';
import { AddressDto } from './address.mapper';

@ApiTags('customers')
@ApiBearerAuth()
@UseGuards(CustomerJwtGuard)
@Controller('customers/me/addresses')
export class CustomerAddressesController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @ApiOkResponse({ type: AddressDto, isArray: true })
  list(@CurrentCustomer() customer: { id: number }): Promise<AddressDto[]> {
    return this.customers.listAddresses(customer.id);
  }

  @Post()
  @ApiOkResponse({ type: AddressDto })
  create(
    @CurrentCustomer() customer: { id: number },
    @Body() dto: CreateAddressDto,
  ): Promise<AddressDto> {
    return this.customers.createAddress(customer.id, dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: AddressDto })
  update(
    @CurrentCustomer() customer: { id: number },
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAddressDto,
  ): Promise<AddressDto> {
    return this.customers.updateAddress(customer.id, id, dto);
  }

  @Delete(':id')
  @ApiOkResponse({ type: SuccessResponseDto })
  remove(
    @CurrentCustomer() customer: { id: number },
    @Param('id', ParseIntPipe) id: number,
  ): Promise<SuccessResponseDto> {
    return this.customers.deleteAddress(customer.id, id);
  }
}
