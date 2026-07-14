import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../common/auth/permission.guard';
import { RequirePermission } from '../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../common/audit-log/audit-log.interceptor';
import { CurrentAdmin } from '../../../common/auth/current-admin.decorator';
import { BlockerService } from './blocker.service';
import { CreateBlockRuleDto } from './dto/create-block-rule.dto';
import { BlockRuleDto } from './blocker.mapper';

@ApiTags('admin/net-profit/blocker')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/blocker')
export class AdminBlockerController {
  constructor(private readonly blocker: BlockerService) {}

  @Get()
  @RequirePermission('net_profit_blocker.manage')
  @ApiOkResponse({ type: BlockRuleDto, isArray: true })
  list(): Promise<BlockRuleDto[]> {
    return this.blocker.list();
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
  updateSettings(@Body() dto: { autoBlockOnFraud?: boolean }) {
    return this.blocker.updateSettings(dto);
  }
}
