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
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';

@ApiTags('admin/pages')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/pages')
export class AdminPagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @RequirePermission('page.view')
  list(@Query() { page, pageSize }: PaginationQueryDto) {
    return this.pages.adminList(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('page.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.pages.adminGet(id);
  }

  @Post()
  @RequirePermission('page.create')
  create(@Body() dto: CreatePageDto) {
    return this.pages.create(dto);
  }

  @Patch(':id')
  @RequirePermission('page.update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePageDto) {
    return this.pages.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('page.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pages.delete(id);
  }
}
