import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { PromoVideosService } from './promo-videos.service';
import { PublicPromoVideoDto } from './promo-videos.mapper';

@ApiTags('promo-videos')
@Controller('promo-videos')
export class PromoVideosController {
  constructor(private readonly promoVideos: PromoVideosService) {}

  @Get()
  @ApiOkResponse({ type: [PublicPromoVideoDto] })
  list(@Query() { locale }: LocaleQueryDto): Promise<PublicPromoVideoDto[]> {
    return this.promoVideos.publicList(locale ?? 'EN');
  }
}
