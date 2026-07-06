import {
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
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
import { GiftVouchersService } from './gift-vouchers.service';
import { CreateGiftVoucherDto } from './dto/create-gift-voucher.dto';
import { GiftVoucherDto } from './gift-vouchers.mapper';

@ApiTags('admin/gift-vouchers')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/gift-vouchers')
export class AdminGiftVouchersController {
  constructor(private readonly vouchers: GiftVouchersService) {}

  @Get()
  @RequirePermission('gift_voucher.view')
  @ApiPaginatedResponse(GiftVoucherDto)
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
  ): Promise<PaginatedResult<GiftVoucherDto>> {
    return this.vouchers.list(page ?? 1, pageSize ?? 20);
  }

  @Post()
  @RequirePermission('gift_voucher.create')
  @ApiOkResponse({ type: GiftVoucherDto })
  create(@Body() dto: CreateGiftVoucherDto): Promise<GiftVoucherDto> {
    return this.vouchers.create(dto);
  }

  @Post(':id/deactivate')
  @RequirePermission('gift_voucher.update')
  @ApiOkResponse({ type: GiftVoucherDto })
  deactivate(@Param('id', ParseIntPipe) id: number): Promise<GiftVoucherDto> {
    return this.vouchers.deactivate(id);
  }
}
