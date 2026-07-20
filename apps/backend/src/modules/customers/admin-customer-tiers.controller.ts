import { Body, Controller, Get, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CustomerTiersService, CustomerTierDto, CustomerTierCountDto } from './customer-tiers.service';
import { UpdateCustomerTiersDto } from './dto/update-customer-tiers.dto';

@ApiTags('admin/customer-tiers')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/customer-tiers')
export class AdminCustomerTiersController {
  constructor(private readonly tiers: CustomerTiersService) {}

  @Get()
  @RequirePermission('customer.view')
  @ApiOkResponse({ type: [CustomerTierDto] })
  list(): Promise<CustomerTierDto[]> {
    return this.tiers.list();
  }

  @Get('counts')
  @RequirePermission('customer.view')
  @ApiOkResponse({ type: [CustomerTierCountDto] })
  counts(): Promise<CustomerTierCountDto[]> {
    return this.tiers.countsByTier();
  }

  @Put()
  @RequirePermission('customer.manage')
  @ApiOkResponse({ type: [CustomerTierDto] })
  replace(@Body() dto: UpdateCustomerTiersDto): Promise<CustomerTierDto[]> {
    return this.tiers.replace(dto.tiers);
  }
}
