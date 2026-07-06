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
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { AdminBrandDto } from './brands.mapper';

@ApiTags('admin/brands')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/brands')
export class AdminBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @RequirePermission('brand.view')
  @ApiPaginatedResponse(AdminBrandDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<AdminBrandDto>> {
    return this.brands.adminList(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('brand.view')
  @ApiOkResponse({ type: AdminBrandDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminBrandDto> {
    return this.brands.adminGet(id);
  }

  @Post()
  @RequirePermission('brand.create')
  @ApiOkResponse({ type: AdminBrandDto })
  create(@Body() dto: CreateBrandDto): Promise<AdminBrandDto> {
    return this.brands.create(dto);
  }

  @Patch(':id')
  @RequirePermission('brand.update')
  @ApiOkResponse({ type: AdminBrandDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateBrandDto,
  ): Promise<AdminBrandDto> {
    return this.brands.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('brand.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.brands.delete(id);
  }
}
