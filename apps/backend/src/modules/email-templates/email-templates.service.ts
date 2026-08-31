import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@amader/db';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ImportEmailTemplateItemDto } from './dto/import-email-templates.dto';
import { EmailSettingsService } from '../email-settings/email-settings.service';
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
  orderNotificationEmail: string;
}

const SETTINGS_DEFAULTS: EmailTemplateSettingsJson = {
  logoMediaId: null,
  contactEmail: '',
  copyright: '',
  logoHeight: 40,
  customCss: '',
  orderNotificationEmail: '',
};

@Injectable()
export class EmailTemplatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly emailSettings: EmailSettingsService,
  ) {}

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

  // Portable snapshot of every template — the shape import() below accepts,
  // so an export from one environment restores into another. Deliberately
  // omits `id` (meaningless across databases) and defaultSubject/
  // defaultBodyHtml (those are the seeded originals that "Reset to default"
  // restores; carrying another environment's copy across would quietly
  // redefine what "default" means here).
  async exportAll(keys?: string[]): Promise<{
    version: number;
    exportedAt: string;
    templates: Record<string, unknown>[];
  }> {
    const rows = await this.prisma.client.emailTemplate.findMany({
      where: keys && keys.length > 0 ? { key: { in: keys } } : undefined,
      orderBy: { key: 'asc' },
    });
    return {
      version: 1,
      exportedAt: new Date().toISOString(),
      templates: rows.map((r) => ({
        key: r.key,
        group: r.group,
        title: r.title,
        description: r.description,
        subject: r.subject,
        bodyHtml: r.bodyHtml,
        variables: r.variables,
        enabled: r.enabled,
      })),
    };
  }

  async import(
    templates: ImportEmailTemplateItemDto[],
    overwriteExisting: boolean,
  ): Promise<{ created: string[]; updated: string[]; skipped: string[] }> {
    const created: string[] = [];
    const updated: string[] = [];
    const skipped: string[] = [];

    for (const t of templates) {
      const existing = await this.prisma.client.emailTemplate.findUnique({
        where: { key: t.key },
      });

      if (existing && !overwriteExisting) {
        skipped.push(t.key);
        continue;
      }

      const variables = (t.variables ?? []) as unknown as Prisma.InputJsonValue;

      if (existing) {
        // defaultSubject/defaultBodyHtml are NOT touched — "Reset to default"
        // must still restore this installation's own seeded original, not
        // whatever the imported file happened to contain.
        await this.prisma.client.emailTemplate.update({
          where: { key: t.key },
          data: {
            group: t.group,
            title: t.title,
            description: t.description ?? existing.description,
            subject: t.subject,
            bodyHtml: t.bodyHtml,
            variables,
            ...(t.enabled === undefined ? {} : { enabled: t.enabled }),
          },
        });
        updated.push(t.key);
      } else {
        // A brand-new template has no prior "default" to preserve, so the
        // imported content becomes its default too — otherwise "Reset to
        // default" on it would blank the template out.
        await this.prisma.client.emailTemplate.create({
          data: {
            key: t.key,
            group: t.group,
            title: t.title,
            description: t.description ?? '',
            subject: t.subject,
            bodyHtml: t.bodyHtml,
            defaultSubject: t.subject,
            defaultBodyHtml: t.bodyHtml,
            variables,
            canDisable: true,
            enabled: t.enabled ?? true,
          },
        });
        created.push(t.key);
      }
    }

    return { created, updated, skipped };
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
      // `custom_css` is injected raw into a <style> element, so a value
      // containing `</style` terminates that element early and everything
      // after it escapes into the visible email as markup. Production hit
      // exactly this: a copy of the base header pasted into the Custom CSS
      // box broke out and rendered a second header with an unresolved
      // `{{ logo_html }}` in it. CSS has no legitimate use for the sequence,
      // so it is stripped rather than escaped.
      custom_css: (settings.customCss || '').replace(/<\/\s*style/gi, ''),
      contact_email: settings.contactEmail || (await this.emailSettings.getConfig()).senderEmail || '',
    };

    // Substitute the body FIRST, then splice in the already-substituted
    // header/footer — and never substitute again afterwards.
    //
    // The previous order (splice, then one final pass over the whole
    // document) re-substituted content that had just been injected. Any
    // settings-derived value containing `{{ ... }}` therefore got expanded a
    // second time: a `custom_css` holding a pasted copy of the base header
    // rendered the header three times over and left a literal
    // `{{ logo_html }}` visible in the email, because the tokens introduced
    // by the last pass had no pass left to resolve them. Substituting exactly
    // once per source string makes that structurally impossible, whatever an
    // admin pastes into a settings field.
    //
    // `header`/`footer` are not in chromeVars, so this first pass leaves those
    // two tokens intact for the splices below.
    let html = this.substitute(bodyHtml, chromeVars);

    // Function replacers (not plain strings) for `String.prototype.replace`
    // here: a plain-string second argument interprets `$`-sequences ($$, $&,
    // $`, $') as special patterns, which would corrupt a header/footer body
    // (or a settings-derived value injected into it) containing one. A
    // function replacer's return value is inserted verbatim.
    const header = await this.prisma.client.emailTemplate.findUnique({ where: { key: 'core_base_header' } });
    if (header) {
      const substituted = this.substitute(header.bodyHtml, chromeVars);
      html = html.replace(/\{\{\s*header\s*\}\}/g, () => substituted);
    }
    const footer = await this.prisma.client.emailTemplate.findUnique({ where: { key: 'core_base_footer' } });
    if (footer) {
      const substituted = this.substitute(footer.bodyHtml, chromeVars);
      html = html.replace(/\{\{\s*footer\s*\}\}/g, () => substituted);
    }

    return { subject: this.substitute(subject, variables), html };
  }
}
