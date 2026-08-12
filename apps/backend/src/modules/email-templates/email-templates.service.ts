import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  EmailTemplateDto,
  EmailTemplatePreviewDto,
  EmailTemplateSettingsDto,
  EmailTemplateVariable,
  toEmailTemplateDto,
} from './email-templates.mapper';

const SETTINGS_KEY = 'email_template.settings';
const VARIABLE_TOKEN = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;

interface EmailTemplateSettingsJson {
  logoMediaId: number | null;
  contactEmail: string;
  copyright: string;
  logoHeight: number;
  customCss: string;
}

const SETTINGS_DEFAULTS: EmailTemplateSettingsJson = {
  logoMediaId: null,
  contactEmail: '',
  copyright: '',
  logoHeight: 40,
  customCss: '',
};

@Injectable()
export class EmailTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(): Promise<EmailTemplateDto[]> {
    const rows = await this.prisma.client.emailTemplate.findMany({ orderBy: { id: 'asc' } });
    return rows.map(toEmailTemplateDto);
  }

  async get(key: string): Promise<EmailTemplateDto> {
    const row = await this.findOrThrow(key);
    return toEmailTemplateDto(row);
  }

  async update(
    key: string,
    input: { subject?: string; bodyHtml?: string; enabled?: boolean },
  ): Promise<EmailTemplateDto> {
    const row = await this.findOrThrow(key);
    const updated = await this.prisma.client.emailTemplate.update({
      where: { key },
      data: {
        subject: input.subject ?? undefined,
        bodyHtml: input.bodyHtml ?? undefined,
        // A template that can't be disabled ignores an `enabled` write —
        // the toggle UI never renders for these rows, but this is a second
        // guard against a direct API call flipping it anyway.
        enabled: row.canDisable ? (input.enabled ?? undefined) : true,
      },
    });
    return toEmailTemplateDto(updated);
  }

  async reset(key: string): Promise<EmailTemplateDto> {
    const row = await this.findOrThrow(key);
    const updated = await this.prisma.client.emailTemplate.update({
      where: { key },
      data: { subject: row.defaultSubject, bodyHtml: row.defaultBodyHtml },
    });
    return toEmailTemplateDto(updated);
  }

  async getSettings(): Promise<EmailTemplateSettingsDto> {
    const json = await this.getSettingsJson();
    const media = json.logoMediaId
      ? await this.prisma.client.media.findUnique({ where: { id: json.logoMediaId } })
      : null;
    return { ...json, logoUrl: media?.url ?? null };
  }

  async updateSettings(input: Partial<EmailTemplateSettingsJson>): Promise<EmailTemplateSettingsDto> {
    const current = await this.getSettingsJson();
    // class-transformer's plainToInstance() (run by the global ValidationPipe's
    // transform: true) puts every declared DTO property onto `input`, using
    // `undefined` for fields the caller didn't send — it does not omit them.
    // A plain `{ ...current, ...input }` merge would therefore copy those
    // `undefined` values as own properties, clobbering `current`'s real values
    // and causing Prisma to drop those keys from the stored JSON entirely.
    // Filter them out first so only genuinely-provided fields override `current`.
    const definedInput = Object.fromEntries(
      Object.entries(input).filter(([, v]) => v !== undefined),
    ) as Partial<EmailTemplateSettingsJson>;
    const next: EmailTemplateSettingsJson = { ...current, ...definedInput };
    await this.prisma.client.setting.upsert({
      where: { key: SETTINGS_KEY },
      create: { key: SETTINGS_KEY, value: next as never },
      update: { value: next as never },
    });
    return this.getSettings();
  }

  // Renders a template for actual sending. Returns null when the template
  // is disabled — the caller's job is to skip sending, not this method's.
  // Nothing in this sub-project calls this yet; it exists for the
  // order-lifecycle/password-reset/contact-form sub-projects that follow.
  async render(key: string, variables: Record<string, string>): Promise<{ subject: string; html: string } | null> {
    const row = await this.findOrThrow(key);
    if (row.canDisable && !row.enabled) return null;
    return this.renderWithChrome(row.bodyHtml, row.subject, variables);
  }

  async preview(key: string, draft: { subject?: string; bodyHtml?: string }): Promise<EmailTemplatePreviewDto> {
    const row = await this.findOrThrow(key);
    const variableList = row.variables as unknown as EmailTemplateVariable[];
    const placeholders: Record<string, string> = {};
    for (const v of variableList) placeholders[v.key] = `[${v.key}]`;
    return this.renderWithChrome(draft.bodyHtml ?? row.bodyHtml, draft.subject ?? row.subject, placeholders);
  }

  private async findOrThrow(key: string) {
    const row = await this.prisma.client.emailTemplate.findUnique({ where: { key } });
    if (!row) throw new NotFoundException(`Email template "${key}" not found`);
    return row;
  }

  private async getSettingsJson(): Promise<EmailTemplateSettingsJson> {
    const row = await this.prisma.client.setting.findUnique({ where: { key: SETTINGS_KEY } });
    return row ? { ...SETTINGS_DEFAULTS, ...(row.value as object) } : SETTINGS_DEFAULTS;
  }

  private substitute(text: string, variables: Record<string, string>): string {
    return text.replace(VARIABLE_TOKEN, (match, name: string) => (name in variables ? variables[name] : match));
  }

  // Wraps bodyHtml in the Base header/footer templates (if it references
  // `{{ header }}`/`{{ footer }}` — a template without either token, e.g.
  // one that shouldn't get the full chrome, renders standalone) and injects
  // the settings-derived chrome variables (logo, copyright, custom CSS)
  // alongside the caller's own event variables.
  private async renderWithChrome(
    bodyHtml: string,
    subject: string,
    variables: Record<string, string>,
  ): Promise<{ subject: string; html: string }> {
    const settings = await this.getSettings();
    const chromeVars: Record<string, string> = {
      ...variables,
      logo_html: settings.logoUrl
        ? `<img src="${settings.logoUrl}" alt="" height="${settings.logoHeight}" style="height:${settings.logoHeight}px;" />`
        : '',
      copyright: settings.copyright || `Copyright © ${new Date().getFullYear()}`,
      custom_css: settings.customCss || '',
    };

    let html = bodyHtml;
    const header = await this.prisma.client.emailTemplate.findUnique({ where: { key: 'core_base_header' } });
    if (header) html = html.replace(/\{\{\s*header\s*\}\}/g, this.substitute(header.bodyHtml, chromeVars));
    const footer = await this.prisma.client.emailTemplate.findUnique({ where: { key: 'core_base_footer' } });
    if (footer) html = html.replace(/\{\{\s*footer\s*\}\}/g, this.substitute(footer.bodyHtml, chromeVars));
    html = this.substitute(html, variables);

    return { subject: this.substitute(subject, variables), html };
  }
}
