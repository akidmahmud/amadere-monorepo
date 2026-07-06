import { Body, Controller, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { SuccessResponseDto } from '../../common/dto/success-response.dto';
import { NewsletterService } from './newsletter.service';
import { SubscribeNewsletterDto } from './dto/subscribe-newsletter.dto';

@ApiTags('newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletter: NewsletterService) {}

  @Post('subscribe')
  @ApiOkResponse({ type: SuccessResponseDto })
  subscribe(@Body() dto: SubscribeNewsletterDto): Promise<SuccessResponseDto> {
    return this.newsletter.subscribe(dto);
  }

  @Post('unsubscribe')
  @ApiOkResponse({ type: SuccessResponseDto })
  unsubscribe(
    @Body() dto: SubscribeNewsletterDto,
  ): Promise<SuccessResponseDto> {
    return this.newsletter.unsubscribe(dto);
  }
}
