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
import { ProductBundlesService } from './product-bundles.service';
import { CreateProductBundleDto } from './dto/create-product-bundle.dto';
import { UpdateProductBundleDto } from './dto/update-product-bundle.dto';

@ApiTags('admin/product-bundles')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/product-bundles')
export class AdminProductBundlesController {
  constructor(private readonly bundles: ProductBundlesService) {}

  @Get()
  @RequirePermission('product_bundle.view')
  list(@Query() { page, pageSize }: PaginationQueryDto) {
    return this.bundles.adminList(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('product_bundle.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.bundles.adminGet(id);
  }

  @Post()
  @RequirePermission('product_bundle.create')
  create(@Body() dto: CreateProductBundleDto) {
    return this.bundles.create(dto);
  }

  @Patch(':id')
  @RequirePermission('product_bundle.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductBundleDto,
  ) {
    return this.bundles.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('product_bundle.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.bundles.delete(id);
  }
}
