import { Controller, Get, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import { GiftVouchersService } from './gift-vouchers.service';
import { GiftVoucherCheckDto } from './gift-vouchers.mapper';

@ApiTags('gift-vouchers')
@Controller('gift-vouchers')
export class GiftVouchersController {
  constructor(private readonly vouchers: GiftVouchersService) {}

  @Get(':code/check')
  @ApiOkResponse({ type: GiftVoucherCheckDto })
  check(@Param('code') code: string): Promise<GiftVoucherCheckDto> {
    return this.vouchers.check(code);
  }
}
