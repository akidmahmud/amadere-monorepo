import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { LeadsService } from './leads.service';
import { LeadDashboardService } from './lead-dashboard.service';
import {
  CreateLeadDto,
  LeadDashboardQueryDto,
  LeadQueryDto,
  LogLeadCallDto,
  UpdateLeadDto,
} from './dto/lead.dto';

// Lead Center: same permissions as customers — the same team works both.
@ApiTags('admin/leads')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/leads')
export class AdminLeadsController {
  constructor(
    private readonly leads: LeadsService,
    private readonly board: LeadDashboardService,
  ) {}

  @Get()
  @RequirePermission('customer.view')
  list(@Query() q: LeadQueryDto) {
    return this.leads.list(q);
  }

  @Get('dashboard')
  @RequirePermission('customer.view')
  dashboard(@Query() q: LeadDashboardQueryDto) {
    return this.board.dashboard(q);
  }

  @Get('trash')
  @RequirePermission('customer.view')
  trash(@Query() q: LeadQueryDto) {
    return this.leads.listDeleted(q);
  }

  @Post(':id/restore')
  @RequirePermission('customer.manage')
  restore(@Param('id', ParseIntPipe) id: number) {
    return this.leads.restore(id);
  }

  @Post('import')
  @RequirePermission('customer.manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  import(
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: 10 * 1024 * 1024 })] }))
    file: Express.Multer.File,
    // Dry run unless explicitly "false" — the preview is the default.
    @Query('dryRun') dryRun?: string,
  ) {
    return this.leads.import(file.buffer, dryRun !== 'false');
  }

  @Get(':id')
  @RequirePermission('customer.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.leads.get(id);
  }

  @Post()
  @RequirePermission('customer.manage')
  create(@Body() dto: CreateLeadDto) {
    return this.leads.create(dto);
  }

  @Patch(':id')
  @RequirePermission('customer.manage')
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateLeadDto) {
    return this.leads.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('customer.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.leads.remove(id);
  }

  @Post(':id/calls')
  @RequirePermission('customer.view')
  logCall(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: LogLeadCallDto,
    @CurrentAdmin() admin: { id: number },
  ) {
    return this.leads.logCall(id, dto, admin.id);
  }
}
