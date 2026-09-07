import {
  Body,
  Controller,
  Get,
  Post,
  Put,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { ShippingRulesConfig } from '@amader/shared';
import { AdminJwtGuard } from '../../common/auth/admin-jwt.guard';
import { PermissionGuard } from '../../common/auth/permission.guard';
import { RequirePermission } from '../../common/auth/permission.decorator';
import { AuditLogInterceptor } from '../../common/audit-log/audit-log.interceptor';
import { ShippingRulesService, ResolvedQuote } from './shipping-rules.service';
import {
  QuoteShippingRuleDto,
  ShippingRuleQuoteDto,
  UpdateShippingRulesDto,
} from './dto/update-shipping-rules.dto';

// Reuses the shipping_zone.* permissions rather than minting a pair of its
// own: both editors live on the same Shipments page and are the same job
// (setting delivery rates), so a role that could edit one but not the other
// would be a distinction nobody asked for.
@ApiTags('admin/shipping-rules')
@ApiBearerAuth()
@UseGuards(AdminJwtGuard, PermissionGuard)
@UseInterceptors(AuditLogInterceptor)
@Controller('admin/shipping-rules')
export class AdminShippingRulesController {
  constructor(private readonly rules: ShippingRulesService) {}

  @Get()
  @RequirePermission('shipping_zone.view')
  @ApiOkResponse({ type: UpdateShippingRulesDto })
  get(): Promise<ShippingRulesConfig> {
    return this.rules.getConfig();
  }

  @Put()
  @RequirePermission('shipping_zone.update')
  @ApiOkResponse({ type: UpdateShippingRulesDto })
  update(@Body() dto: UpdateShippingRulesDto): Promise<ShippingRulesConfig> {
    return this.rules.update(dto as unknown as ShippingRulesConfig);
  }

  // The two quote endpoints below are gated on `order.view`, NOT on
  // `shipping_zone.view` like the editor above.
  //
  // They are not settings — they are the price suggestion the New Order form
  // and the Order Manager modal show while someone types an order in. Gating
  // them on the Shipments-settings permission meant any staff role with
  // `order.create` but without `shipping_zone.view` got a 403 and simply saw
  // no shipping rule at all, with nothing on screen saying why. Reproduced
  // with an order-only role: "Missing permission: shipping_zone.view".
  //
  // `order.view` rather than `order.create` because the Order Manager modal
  // shows the same suggestion on an existing order, and viewing is the lower
  // bar of the two. A quote reads no customer data — it is a rate-card
  // lookup, weight and district in, price out.

  // POST because the New Order form quotes an unsaved basket, and a
  // line-item list does not belong in a query string.
  @Post('checkout-quote')
  @RequirePermission('order.view')
  @ApiOkResponse({ type: ShippingRuleQuoteDto })
  checkoutQuote(@Body() dto: QuoteShippingRuleDto): Promise<ResolvedQuote> {
    return this.rules.quote(dto, true);
  }

  @Post('quote')
  @RequirePermission('order.view')
  @ApiOkResponse({ type: ShippingRuleQuoteDto })
  quote(@Body() dto: QuoteShippingRuleDto): Promise<ResolvedQuote> {
    return this.rules.quote(dto);
  }
}
