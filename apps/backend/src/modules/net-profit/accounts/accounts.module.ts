import { Module } from '@nestjs/common';
import { NetProfitSettingsModule } from '../settings/net-profit-settings.module';
import { AdminAccountsSettingsController } from './admin-accounts-settings.controller';
import { AccountsSettingsService } from './accounts-settings.service';
import { LedgerService } from './ledger/ledger.service';
import { SalesPostingService } from './ledger/sales-posting.service';
import { PartiesService } from './parties/parties.service';
import { AdminPartiesController } from './parties/admin-parties.controller';
import { CashAccountsService } from './cash-accounts/cash-accounts.service';
import { AdminCashAccountsController } from './cash-accounts/admin-cash-accounts.controller';
import { MastersService } from './masters/masters.service';
import { AdminMastersController } from './masters/admin-masters.controller';
import { ExpensesService } from './expenses/expenses.service';
import { AdminExpensesController } from './expenses/admin-expenses.controller';
import { DuesService } from './dues/dues.service';
import { AdminDuesController } from './dues/admin-dues.controller';
import { CodSettlementService } from './cod/cod-settlement.service';
import { AdminCodController } from './cod/admin-cod.controller';
import { VatService } from './vat/vat.service';
import { AdminVatController } from './vat/admin-vat.controller';
import { ReportsService } from './reports/reports.service';
import { AdminReportsController } from './reports/admin-reports.controller';

// The Accounts module: a posting ledger (LedgerService is its only writer),
// a party master, cash accounts, expense vouchers, receivables/payables, COD
// settlement, VAT reporting and exports.
// Design: docs/superpowers/specs/2026-08-23-accounts-module-redesign-design.md
@Module({
  imports: [NetProfitSettingsModule],
  controllers: [
    AdminAccountsSettingsController,
    AdminPartiesController,
    AdminCashAccountsController,
    AdminMastersController,
    AdminExpensesController,
    AdminDuesController,
    AdminCodController,
    AdminVatController,
    AdminReportsController,
  ],
  providers: [
    AccountsSettingsService,
    LedgerService,
    PartiesService,
    CashAccountsService,
    MastersService,
    DuesService,
    ExpensesService,
    SalesPostingService,
    CodSettlementService,
    VatService,
    ReportsService,
  ],
  // LedgerService and PartiesService are exported because payments and courier
  // post through them (Task 9). LedgerService is the single writer of money —
  // nothing else may insert a LedgerEntry.
  exports: [
    AccountsSettingsService,
    LedgerService,
    PartiesService,
    DuesService,
    ExpensesService,
    SalesPostingService,
    CodSettlementService,
  ],
})
export class AccountsModule {}
