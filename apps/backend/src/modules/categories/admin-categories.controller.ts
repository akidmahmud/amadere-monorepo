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
import { ApiBearerAuth, ApiQuery, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { CategoriesService } from './categories.service';
import { CreateCategoryDto } from './dto/create-category.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';

@ApiTags('admin/categories')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @RequirePermission('category.view')
  @ApiQuery({ name: 'parentId', required: false, type: Number })
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('parentId') parentId?: string,
  ) {
    return this.categories.adminList(
      page ?? 1,
      pageSize ?? 20,
      parentId ? Number(parentId) : undefined,
    );
  }

  @Get(':id')
  @RequirePermission('category.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.categories.adminGet(id);
  }

  @Post()
  @RequirePermission('category.create')
  create(@Body() dto: CreateCategoryDto) {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @RequirePermission('category.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.categories.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('category.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.categories.delete(id);
  }
}
