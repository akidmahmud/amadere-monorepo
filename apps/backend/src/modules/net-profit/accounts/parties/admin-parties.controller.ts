import {
  Body, Controller, Delete, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards, UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../../../common/auth/permission.guard';
import { RequirePermission } from '../../../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../../../common/audit-log/audit-log.interceptor';
import { CurrentAdmin } from '../../../../common/auth/current-admin.decorator';
import { PartiesService } from './parties.service';
import { CreatePartyDto } from './dto/create-party.dto';
import { UpdatePartyDto } from './dto/update-party.dto';
import { PartyQueryDto } from './dto/party-query.dto';

@ApiTags('admin/net-profit/accounts')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/net-profit/accounts/parties')
export class AdminPartiesController {
  constructor(private readonly parties: PartiesService) {}

  @Get()
  @RequirePermission('net_profit_accounts.view')
  list(@Query() query: PartyQueryDto) {
    return this.parties.list(query);
  }

  @Get(':id')
  @RequirePermission('net_profit_accounts.view')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.parties.findOne(id);
  }

  @Get(':id/statement')
  @RequirePermission('net_profit_accounts.view')
  statement(
    @Param('id', ParseIntPipe) id: number,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.parties.statement(id, from, to);
  }

  @Post()
  @RequirePermission('net_profit_accounts.manage')
  create(@Body() dto: CreatePartyDto, @CurrentAdmin() admin: { id: number }) {
    return this.parties.create(dto, admin.id);
  }

  @Put(':id')
  @RequirePermission('net_profit_accounts.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePartyDto) {
    return this.parties.update(id, dto);
  }

  // Soft delete — a party is referenced by every voucher and due it has ever
  // appeared on.
  @Delete(':id')
  @RequirePermission('net_profit_accounts.manage')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.parties.softDelete(id);
  }
}
