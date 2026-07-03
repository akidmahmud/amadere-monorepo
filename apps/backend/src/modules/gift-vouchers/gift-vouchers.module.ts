import { Module } from '@nestjs/common';
import { AdminGiftVouchersController } from './admin-gift-vouchers.controller';
import { GiftVouchersController } from './gift-vouchers.controller';
import { GiftVouchersService } from './gift-vouchers.service';

@Module({
  controllers: [GiftVouchersController, AdminGiftVouchersController],
  providers: [GiftVouchersService],
})
export class GiftVouchersModule {}
