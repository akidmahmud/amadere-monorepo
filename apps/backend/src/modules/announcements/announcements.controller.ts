import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { AnnouncementsService } from './announcements.service';
import { PublicAnnouncementDto } from './announcements.mapper';

@ApiTags('announcements')
@Controller('announcements')
export class AnnouncementsController {
  constructor(private readonly announcements: AnnouncementsService) {}

  @Get()
  @ApiOkResponse({ type: PublicAnnouncementDto, isArray: true })
  list(@Query() { locale }: LocaleQueryDto): Promise<PublicAnnouncementDto[]> {
    return this.announcements.publicList(locale ?? 'EN');
  }
}
