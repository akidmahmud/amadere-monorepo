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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { RedirectsService } from './redirects.service';
import { CreateRedirectDto } from './dto/create-redirect.dto';
import { UpdateRedirectDto } from './dto/update-redirect.dto';

@ApiTags('admin/redirects')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/redirects')
export class AdminRedirectsController {
  constructor(private readonly redirects: RedirectsService) {}

  @Get()
  @RequirePermission('redirect.view')
  list(@Query() { page, pageSize }: PaginationQueryDto) {
    return this.redirects.adminList(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('redirect.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.redirects.adminGet(id);
  }

  @Post()
  @RequirePermission('redirect.create')
  create(@Body() dto: CreateRedirectDto) {
    return this.redirects.create(dto);
  }

  @Patch(':id')
  @RequirePermission('redirect.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRedirectDto,
  ) {
    return this.redirects.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('redirect.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.redirects.delete(id);
  }
}
