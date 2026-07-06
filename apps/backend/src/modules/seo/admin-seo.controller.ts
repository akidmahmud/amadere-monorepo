import {
  Body,
  Controller,
  Delete,
  Get,
  ParseIntPipe,
  Put,
  Query,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Locale, SeoEntityType } from '@amader/db';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { SeoService } from './seo.service';
import { UpsertSeoMetaDto } from './dto/upsert-seo-meta.dto';
import { SeoMetaDto } from './seo.mapper';

@ApiTags('admin/seo-meta')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/seo-meta')
export class AdminSeoController {
  constructor(private readonly seo: SeoService) {}

  @Get()
  @RequirePermission('seo_meta.view')
  @ApiQuery({ name: 'entityType', enum: SeoEntityType })
  @ApiQuery({ name: 'entityId', type: Number })
  @ApiQuery({ name: 'locale', enum: Locale })
  @ApiOkResponse({ type: SeoMetaDto })
  get(
    @Query('entityType') entityType: SeoEntityType,
    @Query('entityId', ParseIntPipe) entityId: number,
    @Query('locale') locale: Locale,
  ): Promise<SeoMetaDto> {
    return this.seo.adminGet(entityType, entityId, locale);
  }

  @Put()
  @RequirePermission('seo_meta.update')
  @ApiOkResponse({ type: SeoMetaDto })
  upsert(@Body() dto: UpsertSeoMetaDto): Promise<SeoMetaDto> {
    return this.seo.adminUpsert(dto);
  }

  @Delete()
  @RequirePermission('seo_meta.delete')
  @ApiQuery({ name: 'entityType', enum: SeoEntityType })
  @ApiQuery({ name: 'entityId', type: Number })
  @ApiQuery({ name: 'locale', enum: Locale })
  remove(
    @Query('entityType') entityType: SeoEntityType,
    @Query('entityId', ParseIntPipe) entityId: number,
    @Query('locale') locale: Locale,
  ): Promise<void> {
    return this.seo.adminDelete(entityType, entityId, locale);
  }
}
