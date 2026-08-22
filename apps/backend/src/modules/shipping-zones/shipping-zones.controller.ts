import { Controller, Get, Query } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { LocaleQueryDto } from '../../common/dto/locale-query.dto';
import { PublicShippingZone, ShippingZonesService } from './shipping-zones.service';
import { PublicShippingZoneDto } from './shipping-zones.mapper';

// Public and read-only: the checkout page lists every zone so the customer
// can see what applies before choosing a district. Same throttle exemption
// as SiteInfoController for the same reason — it is fetched as part of a
// normal page load, not as a burst of API calls.
@SkipThrottle()
@ApiTags('shipping-zones')
@Controller('shipping-zones')
export class ShippingZonesController {
  constructor(private readonly zones: ShippingZonesService) {}

  @Get()
  @ApiOkResponse({ type: PublicShippingZoneDto, isArray: true })
  list(@Query() { locale }: LocaleQueryDto): Promise<PublicShippingZone[]> {
    return this.zones.getPublic(locale ?? 'EN');
  }
}
