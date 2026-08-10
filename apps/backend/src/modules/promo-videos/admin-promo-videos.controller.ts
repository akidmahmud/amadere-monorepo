import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, UseGuards, UseInterceptors } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { PromoVideosService } from './promo-videos.service';
import { CreatePromoVideoDto } from './dto/create-promo-video.dto';
import { UpdatePromoVideoDto } from './dto/update-promo-video.dto';
import { ReorderPromoVideosDto } from './dto/reorder-promo-videos.dto';
import { AdminPromoVideoDto } from './promo-videos.mapper';

@ApiTags('admin/promo-videos')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/promo-videos')
export class AdminPromoVideosController {
  constructor(private readonly promoVideos: PromoVideosService) {}

  @Get()
  @RequirePermission('promo_video.view')
  @ApiOkResponse({ type: [AdminPromoVideoDto] })
  list(): Promise<AdminPromoVideoDto[]> {
    return this.promoVideos.adminList();
  }

  @Get(':id')
  @RequirePermission('promo_video.view')
  @ApiOkResponse({ type: AdminPromoVideoDto })
  get(@Param('id', ParseIntPipe) id: number): Promise<AdminPromoVideoDto> {
    return this.promoVideos.adminGet(id);
  }

  @Post()
  @RequirePermission('promo_video.create')
  @ApiOkResponse({ type: AdminPromoVideoDto })
  create(@Body() dto: CreatePromoVideoDto): Promise<AdminPromoVideoDto> {
    return this.promoVideos.create(dto);
  }

  @Patch('reorder')
  @RequirePermission('promo_video.update')
  reorder(@Body() dto: ReorderPromoVideosDto): Promise<void> {
    return this.promoVideos.reorder(dto.ids);
  }

  @Patch(':id')
  @RequirePermission('promo_video.update')
  @ApiOkResponse({ type: AdminPromoVideoDto })
  update(@Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePromoVideoDto): Promise<AdminPromoVideoDto> {
    return this.promoVideos.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('promo_video.delete')
  remove(@Param('id', ParseIntPipe) id: number): Promise<void> {
    return this.promoVideos.delete(id);
  }
}
