import { Injectable } from '@nestjs/common';
import { NetProfitSettingsService } from '../settings/net-profit-settings.service';
import {
  COD_FEE_DEFAULTS,
  CodFeeSettings,
  POSTING_DEFAULTS,
  PostingSettings,
  VAT_DEFAULTS,
  VatSettings,
} from './accounts.constants';

/**
 * Store-level VAT and COD-fee configuration.
 *
 * Split out of the old monolithic AccountsService: these four methods are the
 * only part of it that survived the ledger redesign unchanged, and checkout
 * reads the VAT rate, so they should not sit inside a reporting service that
 * is still being rebuilt.
 */
@Injectable()
export class AccountsSettingsService {
  constructor(private readonly settings: NetProfitSettingsService) {}

  async getVatSettings(): Promise<VatSettings> {
    return this.settings.getNamespace('accounts_vat', VAT_DEFAULTS);
  }

  async updateVatSettings(dto: Partial<VatSettings>): Promise<VatSettings> {
    await this.settings.setNamespace('accounts_vat', dto);
    return this.getVatSettings();
  }

  async getCodFeeSettings(): Promise<CodFeeSettings> {
    return this.settings.getNamespace('cod_fee', COD_FEE_DEFAULTS);
  }

  async updateCodFeeSettings(dto: Partial<CodFeeSettings>): Promise<CodFeeSettings> {
    await this.settings.setNamespace('cod_fee', dto);
    return this.getCodFeeSettings();
  }

  async getPostingSettings(): Promise<PostingSettings> {
    return this.settings.getNamespace('accounts_posting', POSTING_DEFAULTS);
  }

  async updatePostingSettings(dto: Partial<PostingSettings>): Promise<PostingSettings> {
    await this.settings.setNamespace('accounts_posting', dto);
    return this.getPostingSettings();
  }
}
