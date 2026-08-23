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
import { AuthorsService } from './authors.service';
import { CreateAuthorDto } from './dto/create-author.dto';
import { UpdateAuthorDto } from './dto/update-author.dto';
import { AdminAuthorDto } from './authors.mapper';

@ApiTags('admin/authors')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/authors')
export class AdminAuthorsController {
  constructor(private readonly authors: AuthorsService) {}

  @Get()
  @RequirePermission('author.view')
  @ApiPaginatedResponse(AdminAuthorDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<AdminAuthorDto>> {
    return this.authors.adminList(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('author.view')
  @ApiOkResponse({ type: AdminAuthorDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminAuthorDto> {
    return this.authors.adminGet(id);
  }

  @Post()
  @RequirePermission('author.create')
  @ApiOkResponse({ type: AdminAuthorDto })
  create(@Body() dto: CreateAuthorDto): Promise<AdminAuthorDto> {
    return this.authors.create(dto);
  }

  @Patch(':id')
  @RequirePermission('author.update')
  @ApiOkResponse({ type: AdminAuthorDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAuthorDto,
  ): Promise<AdminAuthorDto> {
    return this.authors.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('author.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.authors.delete(id);
  }
}
