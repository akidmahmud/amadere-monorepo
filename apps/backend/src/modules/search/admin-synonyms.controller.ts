import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { SynonymsService } from './synonyms.service';
import {
  CreateSynonymGroupDto,
  UpdateSynonymGroupDto,
} from './dto/synonym-group.dto';

@ApiTags('admin/search-synonyms')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/search-synonyms')
export class AdminSynonymsController {
  constructor(private readonly synonyms: SynonymsService) {}

  @Get()
  @RequirePermission('search_synonym.view')
  list() {
    return this.synonyms.list();
  }

  @Post()
  @RequirePermission('search_synonym.create')
  create(@Body() dto: CreateSynonymGroupDto) {
    return this.synonyms.create(dto);
  }

  @Patch(':id')
  @RequirePermission('search_synonym.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSynonymGroupDto,
  ) {
    return this.synonyms.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('search_synonym.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.synonyms.delete(id);
  }
}
