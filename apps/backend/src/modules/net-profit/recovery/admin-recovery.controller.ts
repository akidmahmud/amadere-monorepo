import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseBoolPipe,
  ParseFilePipe,
  ParseIntPipe,
  Post,
  Put,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { CheckoutAddressDto } from '../../orders/dto/checkout-address.dto';
import { RecoveryService, RecoveryListFilters } from './recovery.service';

const MAX_CSV_BYTES = 2 * 1024 * 1024;

@ApiTags('admin/net-profit/recovery')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/recovery')
export class AdminRecoveryController {
  constructor(private readonly recovery: RecoveryService) {}

  @Get()
  @RequirePermission('net_profit_recovery.manage')
  list(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('recovered', new ParseBoolPipe({ optional: true })) recovered?: boolean,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    const filters: RecoveryListFilters = { recovered, q, from, to };
    return this.recovery.list(page ?? 1, pageSize ?? 20, filters);
  }

  @Get('rate')
  @RequirePermission('net_profit_recovery.manage')
  rate() {
    return this.recovery.recoveryRate();
  }

  @Get('export')
  @RequirePermission('net_profit_recovery.manage')
  async export(
    @Res() res: Response,
    @Query('recovered', new ParseBoolPipe({ optional: true })) recovered?: boolean,
    @Query('q') q?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ): Promise<void> {
    const csv = await this.recovery.exportCsv({ recovered, q, from, to });
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="incomplete-orders-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Post('import')
  @RequirePermission('net_profit_recovery.manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  import(
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: MAX_CSV_BYTES })] }))
    file: Express.Multer.File,
  ) {
    return this.recovery.importCsv(file.buffer.toString('utf-8'));
  }

  @Post('clear')
  @RequirePermission('net_profit_recovery.manage')
  async clearAll(@Query('recovered', new ParseBoolPipe({ optional: true })) recovered?: boolean) {
    const count = await this.recovery.clearAll({ recovered });
    return { count };
  }

  @Delete(':id')
  @RequirePermission('net_profit_recovery.manage')
  async remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.recovery.delete(id);
  }

  @Post(':id/send')
  @RequirePermission('net_profit_recovery.manage')
  async send(@Param('id', ParseIntPipe) id: number) {
    await this.recovery.sendRecovery(id);
    return { success: true };
  }

  @Post(':id/create-order')
  @RequirePermission('net_profit_recovery.manage')
  createOrder(@Param('id', ParseIntPipe) id: number, @Body() dto: CheckoutAddressDto) {
    return this.recovery.createOrderFromIncomplete(id, dto);
  }

  @Get('settings')
  @RequirePermission('net_profit_recovery.manage')
  getSettings() {
    return this.recovery.getSettings();
  }

  @Put('settings')
  @RequirePermission('net_profit_recovery.manage')
  updateSettings(@Body() dto: { enabled?: boolean; delayHours?: number; maxAttempts?: number; quietHoursStart?: number; quietHoursEnd?: number }) {
    return this.recovery.updateSettings(dto);
  }
}
