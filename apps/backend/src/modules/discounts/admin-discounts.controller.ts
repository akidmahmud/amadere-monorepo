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
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';

@ApiTags('admin/discounts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/discounts')
export class AdminDiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Get()
  @RequirePermission('discount.view')
  list(@Query() { page, pageSize }: PaginationQueryDto) {
    return this.discounts.list(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('discount.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.discounts.get(id);
  }

  @Post()
  @RequirePermission('discount.create')
  create(@Body() dto: CreateDiscountDto) {
    return this.discounts.create(dto);
  }

  @Patch(':id')
  @RequirePermission('discount.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDiscountDto,
  ) {
    return this.discounts.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('discount.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.discounts.delete(id);
  }
}
