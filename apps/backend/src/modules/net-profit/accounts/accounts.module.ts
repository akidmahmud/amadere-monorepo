import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { AdminAccountsController } from './admin-accounts.controller';
import { AccountsService } from './accounts.service';

@Module({
  imports: [NetProfitSettingsModule],
  controllers: [AdminAccountsController],
  providers: [AccountsService],
})
export class AccountsModule {}
