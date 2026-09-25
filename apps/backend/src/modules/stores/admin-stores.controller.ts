import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import {
  Can,
  type PermissionCheck,
  RequireAnyPermission,
  RequirePermission,
} from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { StoresService } from './stores.service';
import { AssignStaffDto, UpsertStoreDto } from './dto/store.dto';

@ApiTags('admin/stores')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/stores')
export class AdminStoresController {
  constructor(private readonly stores: StoresService) {}

  // Every POS user needs the list (transfer destination picker).
  @Get()
  @RequireAnyPermission('pos.access', 'stores.manage')
  list(@Can() can: PermissionCheck) {
    return this.stores.list(can('stores.manage') || can('pos.all_stores'));
  }

  @Post()
  @RequirePermission('stores.manage')
  create(@Body() dto: UpsertStoreDto) {
    return this.stores.create(dto);
  }

  @Put(':id')
  @RequirePermission('stores.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpsertStoreDto) {
    return this.stores.update(id, dto);
  }

  @Put(':id/staff')
  @RequirePermission('stores.manage')
  assignStaff(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: AssignStaffDto,
  ) {
    return this.stores.assignStaff(id, dto.adminUserIds);
  }
}
