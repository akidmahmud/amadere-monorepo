import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
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

  // `?withProducts=false` returns section shells without any resolved product
  // arrays — the homepage asks for that and loads each section's products from
  // the route below as it scrolls. Anything else (including the param being
  // absent) keeps the original behaviour, so no existing caller changes.
  @Get()
  @ApiOkResponse({ type: PublicHomepageSectionDto, isArray: true })
  list(
    @Query() { locale }: LocaleQueryDto,
    @Query('withProducts') withProducts?: string,
  ): Promise<PublicHomepageSectionDto[]> {
    return this.sections.publicList(locale ?? 'EN', withProducts !== 'false');
  }

  @Get(':id/products')
  @ApiOkResponse({ description: "One section's resolved products." })
  products(
    @Param('id', ParseIntPipe) id: number,
    @Query() { locale }: LocaleQueryDto,
  ) {
    return this.sections.sectionProducts(id, locale ?? 'EN');
  }
}
