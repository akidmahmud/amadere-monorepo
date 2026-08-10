import { PartialType } from '@nestjs/swagger';
import { CreatePromoVideoDto } from './create-promo-video.dto';

export class UpdatePromoVideoDto extends PartialType(CreatePromoVideoDto) {}
