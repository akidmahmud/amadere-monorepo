import { Controller, Get, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { AnnouncementsService } from './announcements.service';
import { PublicAnnouncementDto } from './announcements.mapper';

// Public, read-only, fetched server-side on every single page load (root
// layout's announcement bar) — see SiteInfoController's comment for why
// this is exempt from the global per-IP throttle.
@SkipThrottle()
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
