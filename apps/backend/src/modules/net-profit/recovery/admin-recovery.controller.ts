import {
  Body,
  Controller,
  Delete,
  Patch,
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
import { CancelIncompleteOrderDto } from './dto/cancel-incomplete-order.dto';
import { UpdateCartReasonDto } from './dto/update-cart-reason.dto';
import { RecoveryEmailOverrideDto } from './dto/recovery-email-override.dto';
import { RecoveryService, RecoveryListFilters } from './recovery.service';
// `import type` is required: it appears in a decorated signature, and with
// emitDecoratorMetadata a value import would be emitted as runtime metadata.
import type { RecoveryOutcome } from './recovery.service';

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
    @Query('stage') stage?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('outcome') outcome?: RecoveryOutcome,
    // Only the sidebar's workload badge passes this (false), to count the
    // carts nobody has written a reason on yet. The funnel table never sends
    // it, so a cart with a reason still shows in the list.
    @Query('hasReason', new ParseBoolPipe({ optional: true })) hasReason?: boolean,
  ) {
    // Defaults to the carts still worth chasing. A recovered or cancelled
    // cart is a closed one — listing them here by default put customers who
    // had already bought into the abandonment list.
    const filters: RecoveryListFilters = {
      outcome: outcome ?? 'open',
      recovered,
      hasReason,
      q,
      stage,
      from,
      to,
    };
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
    @Query('stage') stage?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('outcome') outcome?: RecoveryOutcome,
  ): Promise<void> {
    // 'all' here, unlike the list: an export is a data dump, and defaulting
    // it to open carts would mean the cancelReason column came out empty in
    // every single row.
    const csv = await this.recovery.exportCsv({
      outcome: outcome ?? 'all',
      recovered,
      q,
      stage,
      from,
      to,
    });
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

  // Declared before `:id` routes so "trash" is never parsed as an id.
  @Get('trash')
  @RequirePermission('net_profit_recovery.manage')
  listDeleted(
    @Query() { page, pageSize }: PaginationQueryDto,
    @Query('q') q?: string,
  ) {
    return this.recovery.listDeleted(page ?? 1, pageSize ?? 20, q);
  }

  // Soft delete: the cart leaves every working list now and is restorable for
  // 30 days. This replaced the old cancel action — see RecoveryService.softDelete.
  @Delete(':id')
  @RequirePermission('net_profit_recovery.manage')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @Query('reason') reason?: string,
  ) {
    return this.recovery.softDelete(id, reason);
  }

  @Post(':id/restore')
  @RequirePermission('net_profit_recovery.manage')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.recovery.restore(id);
  }

  @Patch(':id/reason')
  @RequirePermission('net_profit_recovery.manage')
  updateReason(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCartReasonDto,
  ) {
    return this.recovery.updateReason(id, dto.reason);
  }

  @Post(':id/send')
  @RequirePermission('net_profit_recovery.manage')
  async send(@Param('id', ParseIntPipe) id: number) {
    await this.recovery.sendRecovery(id);
    return { success: true };
  }

  // Preview and send are two endpoints over ONE renderer, so what staff
  // approve in the modal is byte-for-byte what the customer receives.
  // POST, not GET: the body carries the sender's edits so the preview can
  // re-render as they type. Nothing is written, so it stays a `view`
  // permission.
  @Post(':id/email-preview')
  @RequirePermission('net_profit_recovery.view')
  emailPreview(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecoveryEmailOverrideDto,
  ) {
    return this.recovery.buildRecoveryEmail(id, dto);
  }

  @Post(':id/send-email')
  @RequirePermission('net_profit_recovery.manage')
  sendEmail(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: RecoveryEmailOverrideDto,
  ) {
    return this.recovery.sendRecoveryEmail(id, dto);
  }

  @Post(':id/cancel')
  @RequirePermission('net_profit_recovery.manage')
  cancel(@Param('id', ParseIntPipe) id: number, @Body() dto: CancelIncompleteOrderDto) {
    return this.recovery.cancel(id, dto.reason);
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
