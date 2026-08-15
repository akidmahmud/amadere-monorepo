import { Controller, Get, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { HomepageSectionsService } from './homepage-sections.service';
import { PublicHomepageSectionDto } from './homepage-sections.mapper';

// Public, read-only, drives the entire homepage — a background ISR
// regeneration that keeps 429ing here fails silently and serves stale
// content indefinitely, not just for the current 5-minute revalidate
// window. See SiteInfoController's comment for the general shared-bucket
// exhaustion this is exempt from.
@SkipThrottle()
@ApiTags('homepage-sections')
@Controller('homepage-sections')
export class HomepageSectionsController {
  constructor(private readonly sections: HomepageSectionsService) {}

  @Get()
  @ApiOkResponse({ type: PublicHomepageSectionDto, isArray: true })
  list(@Query() { locale }: LocaleQueryDto): Promise<PublicHomepageSectionDto[]> {
    return this.sections.publicList(locale ?? 'EN');
  }
}
