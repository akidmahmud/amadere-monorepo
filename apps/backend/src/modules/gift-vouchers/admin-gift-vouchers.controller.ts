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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { GiftVouchersService } from './gift-vouchers.service';
import { CreateGiftVoucherDto } from './dto/create-gift-voucher.dto';

@ApiTags('admin/gift-vouchers')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/gift-vouchers')
export class AdminGiftVouchersController {
  constructor(private readonly vouchers: GiftVouchersService) {}

  @Get()
  @RequirePermission('gift_voucher.view')
  list(@Query() { page, pageSize }: PaginationQueryDto) {
    return this.vouchers.list(page ?? 1, pageSize ?? 20);
  }

  @Post()
  @RequirePermission('gift_voucher.create')
  create(@Body() dto: CreateGiftVoucherDto) {
    return this.vouchers.create(dto);
  }

  @Post(':id/deactivate')
  @RequirePermission('gift_voucher.update')
  deactivate(@Param('id', ParseIntPipe) id: number) {
    return this.vouchers.deactivate(id);
  }
}
