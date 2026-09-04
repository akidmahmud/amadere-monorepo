import { Body, Controller, ForbiddenException, Get, Param, ParseIntPipe, Patch, Post, Query, Res, UseGuards, MaxFileSizeValidator, ParseFilePipe, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { Can, RequirePermission, type PermissionCheck } from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerNoteDto } from './dto/create-customer-note.dto';
import { CreateCustomerCallLogDto } from './dto/create-customer-call-log.dto';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { BulkCustomerActionDto } from './dto/bulk-customer-action.dto';
import { AdminCustomerDto, AdminCustomerListItemDto, AdminCustomerStatsDto } from './admin-customer.mapper';
import { AssignableStaffDto } from './customers.service';

@ApiTags('admin/customers')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Post()
  @RequirePermission('customer.manage')
  @ApiOkResponse({ type: AdminCustomerDto })
  create(@Body() dto: CreateCustomerDto, @CurrentAdmin() admin: { id: number }): Promise<AdminCustomerDto> {
    return this.customers.createCustomer(dto, admin.id);
  }

  @Get()
  @RequirePermission('customer.view')
  @ApiPaginatedResponse(AdminCustomerListItemDto)
  list(@Query() query: AdminCustomerQueryDto): Promise<PaginatedResult<AdminCustomerListItemDto>> {
    return this.customers.adminList(query);
  }

  @Get('stats')
  @RequirePermission('customer.view')
  @ApiOkResponse({ type: AdminCustomerStatsDto })
  stats(): Promise<AdminCustomerStatsDto> {
    return this.customers.adminStats();
  }

  @Get('export')
  @RequirePermission('customer.view')
  async export(@Query() filters: AdminCustomerQueryDto, @Res() res: Response) {
    const csv = await this.customers.adminExportCsv(filters);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="customers-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Get('assignable-staff')
  @RequirePermission('customer.view')
  listAssignableStaff(): Promise<AssignableStaffDto[]> {
    return this.customers.listAssignableStaff();
  }

  // "Deleted Customers" tab — soft-deleted customers only, same filters/
  // shape as the main list. Declared as a static segment so it can never
  // collide with GET(':id') below.
  @Get('trash')
  @RequirePermission('customer.view')
  @ApiPaginatedResponse(AdminCustomerListItemDto)
  listDeleted(@Query() query: AdminCustomerQueryDto): Promise<PaginatedResult<AdminCustomerListItemDto>> {
    return this.customers.adminListDeleted(query);
  }

  @Post('bulk')
  @RequirePermission('customer.manage')
  bulk(@Body() dto: BulkCustomerActionDto, @Can() can: PermissionCheck) {
    // Reassignment is one action among several here, so it cannot be a
    // decorator on the whole endpoint without also locking delete and restore
    // behind a permission that has nothing to do with them.
    if (dto.action === 'assign' && !can('assignment.manage')) {
      throw new ForbiddenException('Missing permission: assignment.manage');
    }
    return this.customers.adminBulkAction(dto);
  }

  @Post('import')
  @RequirePermission('customer.manage')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  import(
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: 2 * 1024 * 1024 })] }))
    file: Express.Multer.File,
  ): Promise<{ imported: number; skipped: number }> {
    return this.customers.importCsv(file.buffer.toString('utf-8'));
  }

  @Get(':id')
  @RequirePermission('customer.view')
  @ApiOkResponse({ type: AdminCustomerDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminCustomerDto> {
    return this.customers.adminGet(id);
  }

  @Patch(':id')
  @RequirePermission('customer.manage')
  @ApiOkResponse({ type: AdminCustomerDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCustomerDto,
    @Can() can: PermissionCheck,
  ): Promise<AdminCustomerDto> {
    // The assignee is one field on the general customer update, so the check
    // has to be on the field rather than the route. Rejected rather than
    // silently dropped: an admin who is told nothing would assume it saved.
    if (dto.assignedAdminId !== undefined && !can('assignment.manage')) {
      throw new ForbiddenException('Missing permission: assignment.manage');
    }
    return this.customers.adminUpdate(id, dto);
  }

  @Get(':id/notes')
  @RequirePermission('customer.view')
  listNotes(@Param('id', ParseIntPipe) id: number) {
    return this.customers.listNotes(id);
  }

  @Post(':id/notes')
  @RequirePermission('customer.manage')
  addNote(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCustomerNoteDto,
    @CurrentAdmin() admin: { id: number },
  ) {
    return this.customers.addNote(id, dto, admin.id);
  }

  @Get(':id/calls')
  @RequirePermission('customer.view')
  listCalls(@Param('id', ParseIntPipe) id: number) {
    return this.customers.listCalls(id);
  }

  @Post(':id/calls')
  @RequirePermission('customer.manage')
  logCall(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateCustomerCallLogDto,
    @CurrentAdmin() admin: { id: number },
  ) {
    return this.customers.logCall(id, dto, admin.id);
  }

  @Post(':id/calls/dial')
  @RequirePermission('customer.manage')
  dial(@Param('id', ParseIntPipe) id: number) {
    return this.customers.dial(id);
  }
}
