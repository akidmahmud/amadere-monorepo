import { Body, Controller, Get, Param, ParseIntPipe, Patch, Post, Query, UseGuards, MaxFileSizeValidator, ParseFilePipe, UploadedFile, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { CurrentAdmin } from '../../common/auth/current-admin.decorator';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { CustomersService } from './customers.service';
import { UpdateCustomerDto } from './dto/update-customer.dto';
import { CreateCustomerNoteDto } from './dto/create-customer-note.dto';
import { CreateCustomerCallLogDto } from './dto/create-customer-call-log.dto';
import { AdminCustomerQueryDto } from './dto/admin-customer-query.dto';
import { AdminCustomerDto, AdminCustomerListItemDto } from './admin-customer.mapper';

@ApiTags('admin/customers')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/customers')
export class AdminCustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  @RequirePermission('customer.view')
  @ApiPaginatedResponse(AdminCustomerListItemDto)
  list(@Query() query: AdminCustomerQueryDto): Promise<PaginatedResult<AdminCustomerListItemDto>> {
    return this.customers.adminList(query);
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
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdateCustomerDto): Promise<AdminCustomerDto> {
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
