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
import { AttributesService } from './attributes.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { CreateAttributeValueDto } from './dto/create-attribute-value.dto';
import { UpdateAttributeValueDto } from './dto/update-attribute-value.dto';

@ApiTags('admin/attributes')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/attributes')
export class AdminAttributesController {
  constructor(private readonly attributes: AttributesService) {}

  @Get()
  @RequirePermission('attribute.view')
  list() {
    return this.attributes.list();
  }

  @Get(':id')
  @RequirePermission('attribute.view')
  get(@Param('id', ParseIntPipe) id: number) {
    return this.attributes.get(id);
  }

  @Post()
  @RequirePermission('attribute.create')
  create(@Body() dto: CreateAttributeDto) {
    return this.attributes.create(dto);
  }

  @Patch(':id')
  @RequirePermission('attribute.update')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAttributeDto,
  ) {
    return this.attributes.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('attribute.delete')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.attributes.delete(id);
  }

  @Post(':id/values')
  @RequirePermission('attribute.update')
  addValue(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAttributeValueDto,
  ) {
    return this.attributes.addValue(id, dto);
  }

  @Patch(':id/values/:valueId')
  @RequirePermission('attribute.update')
  updateValue(
    @Param('id', ParseIntPipe) id: number,
    @Param('valueId', ParseIntPipe) valueId: number,
    @Body() dto: UpdateAttributeValueDto,
  ) {
    return this.attributes.updateValue(id, valueId, dto);
  }

  @Delete(':id/values/:valueId')
  @RequirePermission('attribute.update')
  removeValue(
    @Param('id', ParseIntPipe) id: number,
    @Param('valueId', ParseIntPipe) valueId: number,
  ) {
    return this.attributes.removeValue(id, valueId);
  }
}
