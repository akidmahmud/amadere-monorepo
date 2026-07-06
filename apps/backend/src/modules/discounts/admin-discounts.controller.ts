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
import { DiscountsService } from './discounts.service';
import { CreateDiscountDto } from './dto/create-discount.dto';
import { UpdateDiscountDto } from './dto/update-discount.dto';
import { DiscountDto } from './discounts.mapper';

@ApiTags('admin/discounts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/discounts')
export class AdminDiscountsController {
  constructor(private readonly discounts: DiscountsService) {}

  @Get()
  @RequirePermission('discount.view')
  @ApiPaginatedResponse(DiscountDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<DiscountDto>> {
    return this.discounts.list(page ?? 1, pageSize ?? 20);
  }

  @Get(':id')
  @RequirePermission('discount.view')
  @ApiOkResponse({ type: DiscountDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<DiscountDto> {
    return this.discounts.get(id);
  }

  @Post()
  @RequirePermission('discount.create')
  @ApiOkResponse({ type: DiscountDto })
  create(@Body() dto: CreateDiscountDto): Promise<DiscountDto> {
    return this.discounts.create(dto);
  }

  @Patch(':id')
  @RequirePermission('discount.update')
  @ApiOkResponse({ type: DiscountDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateDiscountDto,
  ): Promise<DiscountDto> {
    return this.discounts.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('discount.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.discounts.delete(id);
  }
}
