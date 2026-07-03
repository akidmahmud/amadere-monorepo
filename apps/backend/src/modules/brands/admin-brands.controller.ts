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
import { BrandsService } from './brands.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';

@ApiTags('admin/brands')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/brands')
export class AdminBrandsController {
  constructor(private readonly brands: BrandsService) {}

  @Get()
  @RequirePermission('brand.view')
  list(@Query() { page, pageSize }: PaginationQueryDto) {
    return this.brands.adminList(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('brand.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.brands.adminGet(id);
  }

  @Post()
  @RequirePermission('brand.create')
  create(@Body() dto: CreateBrandDto) {
    return this.brands.create(dto);
  }

  @Patch(':id')
  @RequirePermission('brand.update')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateBrandDto) {
    return this.brands.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('brand.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.brands.delete(id);
  }
}
