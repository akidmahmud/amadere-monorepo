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
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

@ApiTags('admin/staff')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/staff')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  @RequirePermission('staff.view')
  list() {
    return this.adminUsers.list();
  }

  @Get(':id')
  @RequirePermission('staff.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsers.get(id);
  }

  @Post()
  @RequirePermission('staff.create')
  create(@Body() dto: CreateAdminUserDto) {
    return this.adminUsers.create(dto);
  }

  @Patch(':id')
  @RequirePermission('staff.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.adminUsers.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('staff.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.adminUsers.softDelete(id);
  }
}
