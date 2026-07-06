import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { AdminUsersService } from './admin-users.service';
import { CreateAdminUserDto } from './dto/create-admin-user.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { AdminLoginHistoryEntryDto, AdminUserDto } from './admin-users.mapper';

@ApiTags('admin/staff')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/staff')
export class AdminUsersController {
  constructor(private readonly adminUsers: AdminUsersService) {}

  @Get()
  @RequirePermission('staff.view')
  @ApiOkResponse({ type: AdminUserDto, isArray: true })
  list(): Promise<AdminUserDto[]> {
    return this.adminUsers.list();
  }

  @Get(':id')
  @RequirePermission('staff.view')
  @ApiOkResponse({ type: AdminUserDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminUserDto> {
    return this.adminUsers.get(id);
  }

  @Get(':id/login-history')
  @RequirePermission('staff.view')
  @ApiPaginatedResponse(AdminLoginHistoryEntryDto)
  loginHistory(
    @Param('id', ParseIntPipe) id: number,
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<AdminLoginHistoryEntryDto>> {
    return this.adminUsers.loginHistory(id, page ?? 1, pageSize ?? 20);
  }

  @Post()
  @RequirePermission('staff.create')
  @ApiOkResponse({ type: AdminUserDto })
  create(@Body() dto: CreateAdminUserDto): Promise<AdminUserDto> {
    return this.adminUsers.create(dto);
  }

  @Patch(':id')
  @RequirePermission('staff.update')
  @ApiOkResponse({ type: AdminUserDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAdminUserDto,
  ): Promise<AdminUserDto> {
    return this.adminUsers.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('staff.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.adminUsers.softDelete(id);
  }
}
