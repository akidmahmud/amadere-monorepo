import { Setting } from '@amader/db';

export class SettingDto {
  key!: string;
  value!: unknown;
  updatedAt!: Date;
}

export function toSettingDto(setting: Setting): SettingDto {
  return {
    key: setting.key,
    value: setting.value,
    updatedAt: setting.updatedAt,
  };
}

// Public-safe subset only — never dump every Setting row (some keys are
// secrets, e.g. steadfast_webhook_token).
export class SiteInfoDto {
  siteName!: string;
  logoUrl!: string | null;
}
