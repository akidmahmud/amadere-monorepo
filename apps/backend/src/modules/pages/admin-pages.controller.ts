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
import { PagesService } from './pages.service';
import { CreatePageDto } from './dto/create-page.dto';
import { UpdatePageDto } from './dto/update-page.dto';
import { AdminPageDto } from './pages.mapper';

@ApiTags('admin/pages')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/pages')
export class AdminPagesController {
  constructor(private readonly pages: PagesService) {}

  @Get()
  @RequirePermission('page.view')
  @ApiPaginatedResponse(AdminPageDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<AdminPageDto>> {
    return this.pages.adminList(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('page.view')
  @ApiOkResponse({ type: AdminPageDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminPageDto> {
    return this.pages.adminGet(id);
  }

  @Post()
  @RequirePermission('page.create')
  @ApiOkResponse({ type: AdminPageDto })
  create(@Body() dto: CreatePageDto): Promise<AdminPageDto> {
    return this.pages.create(dto);
  }

  @Patch(':id')
  @RequirePermission('page.update')
  @ApiOkResponse({ type: AdminPageDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePageDto,
  ): Promise<AdminPageDto> {
    return this.pages.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('page.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.pages.delete(id);
  }
}
