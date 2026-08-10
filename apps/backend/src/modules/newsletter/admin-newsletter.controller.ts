import {
  Body,
  Controller,
  Delete,
  Get,
  MaxFileSizeValidator,
  Param,
  ParseFilePipe,
  ParseIntPipe,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiConsumes, ApiTags } from '@nestjs/swagger';
import { memoryStorage } from 'multer';
import type { Response } from 'express';
import { PaginatedResult } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { ApiPaginatedResponse } from '../../common/dto/paginated-response.dto';
import { NewsletterService, type CsvImportResult } from './newsletter.service';
import { NewsletterTagsService } from '../newsletter-tags/newsletter-tags.service';
import { NewsletterSubscriberDto } from './newsletter.mapper';
import { AdminNewsletterQueryDto } from './dto/admin-newsletter-query.dto';
import { BulkDeleteNewsletterDto } from './dto/bulk-delete-newsletter.dto';
import { CreateNewsletterSubscriberDto } from './dto/create-newsletter-subscriber.dto';
import { AddSubscriberTagDto } from './dto/add-subscriber-tag.dto';

const MAX_CSV_BYTES = 5 * 1024 * 1024; // 5MB

@ApiTags('admin/newsletter')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@Controller('admin/newsletter/subscribers')
export class AdminNewsletterController {
  constructor(
    private readonly newsletter: NewsletterService,
    private readonly tags: NewsletterTagsService,
  ) {}

  @Get()
  @RequirePermission('newsletter.view')
  @ApiPaginatedResponse(NewsletterSubscriberDto)
  list(@Query() query: AdminNewsletterQueryDto): Promise<PaginatedResult<NewsletterSubscriberDto>> {
    return this.newsletter.adminList(query);
  }

  @Get('export')
  @RequirePermission('newsletter.view')
  async export(@Query('q') q: string | undefined, @Res() res: Response) {
    const csv = await this.newsletter.exportCsv(q);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="newsletter-subscribers-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(csv);
  }

  @Post('import')
  @RequirePermission('newsletter.create')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage() }))
  importCsv(
    @UploadedFile(new ParseFilePipe({ validators: [new MaxFileSizeValidator({ maxSize: MAX_CSV_BYTES })] }))
    file: Express.Multer.File,
  ): Promise<CsvImportResult> {
    return this.newsletter.importCsv(file.buffer.toString('utf-8'));
  }

  @Post()
  @RequirePermission('newsletter.create')
  create(@Body() dto: CreateNewsletterSubscriberDto): Promise<NewsletterSubscriberDto> {
    return this.newsletter.adminCreate(dto);
  }

  @Post('bulk-delete')
  @RequirePermission('newsletter.delete')
  bulkDelete(@Body() dto: BulkDeleteNewsletterDto): Promise<{ deleted: number }> {
    return this.newsletter.bulkDelete(dto.ids);
  }

  @Post(':id/tags')
  @RequirePermission('newsletter.update')
  addTag(@Param('id', ParseIntPipe) id: number, @Body() dto: AddSubscriberTagDto): Promise<void> {
    return this.tags.addToSubscriber(id, dto.tagId);
  }

  @Delete(':id/tags/:tagId')
  @RequirePermission('newsletter.update')
  removeTag(@Param('id', ParseIntPipe) id: number, @Param('tagId', ParseIntPipe) tagId: number): Promise<void> {
    return this.tags.removeFromSubscriber(id, tagId);
  }

  @Delete(':id')
  @RequirePermission('newsletter.delete')
  async delete(@Param('id', ParseIntPipe) id: number): Promise<void> {
    await this.newsletter.delete(id);
  }
}
