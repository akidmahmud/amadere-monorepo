import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ShippingRulesConfig } from '@amader/shared';
import { ShippingRulesService } from './shipping-rules.service';
import { UpdateShippingRulesDto } from './dto/update-shipping-rules.dto';

@ApiTags('shipping-rules')
@Controller('shipping-rules')
export class ShippingRulesController {
  constructor(private readonly rules: ShippingRulesService) {}

  @Get()
  @ApiOkResponse({ type: UpdateShippingRulesDto })
  async get(): Promise<ShippingRulesConfig> {
    const config = await this.rules.getConfig();
    return { ...config, rules: config.applyOnCheckout ? config.rules.filter((r) => r.deliveryType === 'HOME') : [] };
  }
}
