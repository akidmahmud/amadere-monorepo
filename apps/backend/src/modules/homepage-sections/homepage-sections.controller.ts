import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { HomepageSectionsService } from './homepage-sections.service';
import { PublicHomepageSectionDto } from './homepage-sections.mapper';

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
