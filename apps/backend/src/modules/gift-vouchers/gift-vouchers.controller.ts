import { Controller, Get, Param } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { GiftVouchersService } from './gift-vouchers.service';

@ApiTags('gift-vouchers')
@Controller('gift-vouchers')
export class GiftVouchersController {
  constructor(private readonly vouchers: GiftVouchersService) {}

  @Get(':code/check')
  check(@Param('code') code: string) {
    return this.vouchers.check(code);
  }
}
