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
import { ProductsService } from './products.service';
import { CreateProductDto } from './dto/create-product.dto';
import { UpdateProductDto } from './dto/update-product.dto';
import { CreateProductVariantDto } from './dto/create-product-variant.dto';
import { ProductFilterQueryDto } from './dto/product-filter-query.dto';
import { AdminProductDto } from './dto/product-response.dto';

@ApiTags('admin/products')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/products')
export class AdminProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  @RequirePermission('product.view')
  @ApiPaginatedResponse(AdminProductDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query() filters: ProductFilterQueryDto,
  ): Promise<PaginatedResult<AdminProductDto>> {
    return this.products.adminList(page ?? 1, pageSize ?? 20, filters);
  }

  @Get(':id')
  @RequirePermission('product.view')
  @ApiOkResponse({ type: AdminProductDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminProductDto> {
    return this.products.adminGet(id);
  }

  @Post()
  @RequirePermission('product.create')
  @ApiOkResponse({ type: AdminProductDto })
  create(@Body() dto: CreateProductDto): Promise<AdminProductDto> {
    return this.products.create(dto);
  }

  @Patch(':id')
  @RequirePermission('product.update')
  @ApiOkResponse({ type: AdminProductDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateProductDto,
  ): Promise<AdminProductDto> {
    return this.products.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('product.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.products.delete(id);
  }

  @Post(':id/variants')
  @RequirePermission('product.update')
  @ApiOkResponse({ type: AdminProductDto })
  addVariant(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateProductVariantDto,
  ): Promise<AdminProductDto> {
    return this.products.addVariant(id, dto);
  }

  @Delete(':id/variants/:variantId')
  @RequirePermission('product.update')
  removeVariant(
    @Param('id', ParseIntPipe) id: number,
    @Param('variantId', ParseIntPipe) variantId: number,
  ): Promise<void> {
    return this.products.removeVariant(id, variantId);
  }
}
