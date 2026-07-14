import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
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
import { ApiBearerAuth, ApiConsumes, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { BlockSource } from '@amader/db';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { CurrentAdmin } from '../../../common/auth/current-admin.decorator';
import { BlockerService, ListEntriesArgs } from './blocker.service';
import { CreateBlockRuleDto } from './dto/create-block-rule.dto';
import { UpdateBlockerSettingsDto } from './dto/update-blocker-settings.dto';
import { BlockRuleDto } from './blocker.mapper';
import type { BlockRuleStatus } from './blocker.mapper';
import type { BlockerSettings } from './blocker-settings.types';

const MAX_CSV_BYTES = 2 * 1024 * 1024;

@ApiTags('admin/net-profit/blocker')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/blocker')
export class AdminBlockerController {
  constructor(private readonly blocker: BlockerService) {}

  @Get()
  @RequirePermission('net_profit_blocker.manage')
  list(
    @Query('source') source?: 'MANUAL' | 'AUTO',
    @Query('status') status?: BlockRuleStatus,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<{ items: BlockRuleDto[]; total: number }> {
    const args: ListEntriesArgs = {
      source,
      status,
      q,
      page: page ? Number(page) : undefined,
      pageSize: pageSize ? Number(pageSize) : undefined,
    };
    return this.blocker.list(args);
  }

  @Get('stats')
  @RequirePermission('net_profit_blocker.manage')
  stats() {
    return this.blocker.stats();
  }

  @Post()
  @RequirePermission('net_profit_blocker.manage')
  @ApiOkResponse({ type: BlockRuleDto })
  create(@Body() dto: CreateBlockRuleDto, @CurrentAdmin() admin: { id: number }): Promise<BlockRuleDto> {
    return this.blocker.create(dto, admin.id);
  }

  @Put(':id/active')
  @RequirePermission('net_profit_blocker.manage')
  @ApiOkResponse({ type: BlockRuleDto })
  setActive(@Param('id', ParseIntPipe) id: number, @Body() dto: { isActive: boolean }): Promise<BlockRuleDto> {
    return this.blocker.setActive(id, dto.isActive);
  }

  @Post('bulk-unblock')
  @RequirePermission('net_profit_blocker.manage')
  bulkUnblock(@Body() dto: { source: BlockSource }): Promise<{ count: number }> {
    return this.blocker.bulkUnblock(dto.source).then((count) => ({ count }));
  }

  @Delete(':id')
  @RequirePermission('net_profit_blocker.manage')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.blocker.remove(id);
  }

  @Get('settings')
  @RequirePermission('net_profit_blocker.manage')
  getSettings() {
    return this.blocker.getSettings();
  }

  @Put('settings')
  @RequirePermission('net_profit_blocker.manage')
  updateSettings(@Body() dto: UpdateBlockerSettingsDto): Promise<BlockerSettings> {
    // Nested blobs (rules/thresholds/popup/manual) are validated as opaque
    // JSON in the DTO (see update-blocker-settings.dto.ts) — their real
    // shape is BlockerSettings's, asserted here at the one seam that needs it.
    return this.blocker.updateSettings(dto as unknown as Partial<BlockerSettings>);
  }

  @Get('export')
  @RequirePermission('net_profit_blocker.manage')
  async export(@Query('source') source: 'MANUAL' | 'AUTO' | undefined, @Res() res: Response): Promise<void> {
    const csv = await this.blocker.exportCsv(source);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="blocker-${source ?? 'all'}-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Post('import')
  @RequirePermission('net_profit_blocker.manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  import(
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: MAX_CSV_BYTES })] }))
    file: Express.Multer.File,
    @CurrentAdmin() admin: { id: number },
  ): Promise<{ imported: number; skipped: number }> {
    return this.blocker.importCsv(file.buffer.toString('utf-8'), admin.id);
  }
}
