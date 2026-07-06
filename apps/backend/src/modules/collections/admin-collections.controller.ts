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
import { CollectionsService } from './collections.service';
import { CreateCollectionDto } from './dto/create-collection.dto';
import { UpdateCollectionDto } from './dto/update-collection.dto';
import { AdminCollectionDto } from './collections.mapper';

@ApiTags('admin/collections')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/collections')
export class AdminCollectionsController {
  constructor(private readonly collections: CollectionsService) {}

  @Get()
  @RequirePermission('collection.view')
  @ApiPaginatedResponse(AdminCollectionDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<AdminCollectionDto>> {
    return this.collections.adminList(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('collection.view')
  @ApiOkResponse({ type: AdminCollectionDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminCollectionDto> {
    return this.collections.adminGet(id);
  }

  @Post()
  @RequirePermission('collection.create')
  @ApiOkResponse({ type: AdminCollectionDto })
  create(@Body() dto: CreateCollectionDto): Promise<AdminCollectionDto> {
    return this.collections.create(dto);
  }

  @Patch(':id')
  @RequirePermission('collection.update')
  @ApiOkResponse({ type: AdminCollectionDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCollectionDto,
  ): Promise<AdminCollectionDto> {
    return this.collections.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('collection.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.collections.delete(id);
  }
}
