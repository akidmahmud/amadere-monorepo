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
import { RedirectsService } from './redirects.service';
import { CreateRedirectDto } from './dto/create-redirect.dto';
import { UpdateRedirectDto } from './dto/update-redirect.dto';
import { RedirectDto } from './redirects.mapper';

@ApiTags('admin/redirects')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/redirects')
export class AdminRedirectsController {
  constructor(private readonly redirects: RedirectsService) {}

  @Get()
  @RequirePermission('redirect.view')
  @ApiPaginatedResponse(RedirectDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<RedirectDto>> {
    return this.redirects.adminList(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('redirect.view')
  @ApiOkResponse({ type: RedirectDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<RedirectDto> {
    return this.redirects.adminGet(id);
  }

  @Post()
  @RequirePermission('redirect.create')
  @ApiOkResponse({ type: RedirectDto })
  create(@Body() dto: CreateRedirectDto): Promise<RedirectDto> {
    return this.redirects.create(dto);
  }

  @Patch(':id')
  @RequirePermission('redirect.update')
  @ApiOkResponse({ type: RedirectDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateRedirectDto,
  ): Promise<RedirectDto> {
    return this.redirects.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('redirect.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.redirects.delete(id);
  }
}
