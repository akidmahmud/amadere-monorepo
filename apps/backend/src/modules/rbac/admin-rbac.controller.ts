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
import { RbacService } from './rbac.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';

@ApiTags('admin/rbac')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/rbac')
export class AdminRbacController {
  constructor(private readonly rbac: RbacService) {}

  @Get('permissions')
  @RequirePermission('permission.view')
  listPermissions() {
    return this.rbac.listPermissions();
  }

  @Get('roles')
  @RequirePermission('role.view')
  listRoles() {
    return this.rbac.listRoles();
  }

  @Get('roles/:id')
  @RequirePermission('role.view')
  getRole(@Param('id', ParseIntPipe) id: number) {
    return this.rbac.getRole(id);
  }

  @Post('roles')
  @RequirePermission('role.create')
  createRole(@Body() dto: CreateRoleDto) {
    return this.rbac.createRole(dto);
  }

  @Patch('roles/:id')
  @RequirePermission('role.update')
  updateRole(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRoleDto,
  ) {
    return this.rbac.updateRole(id, dto);
  }

  @Delete('roles/:id')
  @RequirePermission('role.delete')
  deleteRole(@Param('id', ParseIntPipe) id: number) {
    return this.rbac.deleteRole(id);
  }
}
