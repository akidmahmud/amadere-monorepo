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
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { AttributesService } from './attributes.service';
import { CreateAttributeDto } from './dto/create-attribute.dto';
import { UpdateAttributeDto } from './dto/update-attribute.dto';
import { CreateAttributeValueDto } from './dto/create-attribute-value.dto';
import { UpdateAttributeValueDto } from './dto/update-attribute-value.dto';
import { AttributeDto } from './attributes.mapper';

@ApiTags('admin/attributes')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/attributes')
export class AdminAttributesController {
  constructor(private readonly attributes: AttributesService) {}

  @Get()
  @RequirePermission('attribute.view')
  @ApiOkResponse({ type: AttributeDto, isArray: true })
  list(): Promise<AttributeDto[]> {
    return this.attributes.list();
  }

  @Get(':id')
  @RequirePermission('attribute.view')
  @ApiOkResponse({ type: AttributeDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AttributeDto> {
    return this.attributes.get(id);
  }

  @Post()
  @RequirePermission('attribute.create')
  @ApiOkResponse({ type: AttributeDto })
  create(@Body() dto: CreateAttributeDto): Promise<AttributeDto> {
    return this.attributes.create(dto);
  }

  @Patch(':id')
  @RequirePermission('attribute.update')
  @ApiOkResponse({ type: AttributeDto })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAttributeDto,
  ): Promise<AttributeDto> {
    return this.attributes.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('attribute.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.attributes.delete(id);
  }

  @Post(':id/values')
  @RequirePermission('attribute.update')
  @ApiOkResponse({ type: AttributeDto })
  addValue(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateAttributeValueDto,
  ): Promise<AttributeDto> {
    return this.attributes.addValue(id, dto);
  }

  @Patch(':id/values/:valueId')
  @RequirePermission('attribute.update')
  @ApiOkResponse({ type: AttributeDto })
  updateValue(
    @Param('id', ParseIntPipe) id: number,
    @Param('valueId', ParseIntPipe) valueId: number,
    @Body() dto: UpdateAttributeValueDto,
  ): Promise<AttributeDto> {
    return this.attributes.updateValue(id, valueId, dto);
  }

  @Delete(':id/values/:valueId')
  @RequirePermission('attribute.update')
  @ApiOkResponse({ type: AttributeDto })
  removeValue(
    @Param('id', ParseIntPipe) id: number,
    @Param('valueId', ParseIntPipe) valueId: number,
  ): Promise<AttributeDto> {
    return this.attributes.removeValue(id, valueId);
  }
}
