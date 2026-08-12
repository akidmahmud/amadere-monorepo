"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader, Tabs, ToggleSwitch } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import {
  useEmailTemplates,
  useEmailTemplateSettings,
  useUpdateEmailTemplate,
  useUpdateEmailTemplateSettings,
  type EmailTemplate,
} from "@/hooks/useEmailTemplates";
import type { components } from "@/lib/api/schema";

type EmailTemplateGroup = components["schemas"]["EmailTemplateDto"]["group"];

const emailIcon = <Icon name="mail" />;
const gradientStyle = { background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" };

const GROUP_ORDER: EmailTemplateGroup[] = ["BASE", "ACL", "CONTACT", "ECOMMERCE", "NEWSLETTER"];
const GROUP_LABELS: Record<EmailTemplateGroup, string> = {
  BASE: "Base template",
  ACL: "ACL",
  CONTACT: "Contact",
  ECOMMERCE: "Ecommerce",
  NEWSLETTER: "Newsletter",
};

function groupTemplates(templates: EmailTemplate[]): { group: EmailTemplateGroup; items: EmailTemplate[] }[] {
  return GROUP_ORDER.map((group) => ({ group, items: templates.filter((t) => t.group === group) })).filter(
    (g) => g.items.length > 0,
  );
}

function TemplatesTab({ templates }: { templates: EmailTemplate[] }) {
  return (
    <div className="flex flex-col gap-4">
      {groupTemplates(templates).map(({ group, items }) => (
        <Card key={group} className="flex flex-col gap-3">
          <h3 className="font-ui text-sm font-bold text-text">{GROUP_LABELS[group]}</h3>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="border-b border-border pb-2 text-xs font-bold uppercase text-secondary">Template</th>
                <th className="border-b border-border pb-2 text-xs font-bold uppercase text-secondary">Description</th>
                <th className="border-b border-border pb-2 text-right text-xs font-bold uppercase text-secondary">Operations</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <tr key={t.key} className="border-b border-border last:border-b-0">
                  <td className="py-3 text-sm font-semibold text-text">{t.title}</td>
                  <td className="py-3 text-sm text-secondary">{t.description}</td>
                  <td className="py-3 text-right">
                    <Link
                      href={`/settings/email-templates/${t.key}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-inner bg-brand-500 text-white"
                      aria-label={`Edit ${t.title}`}
                    >
                      <Icon name="edit" size={16} />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

function StatusRow({ template }: { template: EmailTemplate }) {
  const update = useUpdateEmailTemplate(template.key);
  return (
    <tr className="border-b border-border last:border-b-0">
      <td className="py-3 text-sm font-semibold text-text">{template.title}</td>
      <td className="py-3 text-sm text-secondary">{template.description}</td>
      <td className="py-3 text-right">
        <ToggleSwitch
          checked={template.enabled}
          disabled={!template.canDisable || update.isPending}
          onChange={(enabled) => update.mutate({ enabled })}
        />
      </td>
    </tr>
  );
}

function StatusTab({ templates }: { templates: EmailTemplate[] }) {
  return (
    <div className="flex flex-col gap-4">
      {groupTemplates(templates).map(({ group, items }) => (
        <Card key={group} className="flex flex-col gap-3">
          <h3 className="font-ui text-sm font-bold text-text">{GROUP_LABELS[group]}</h3>
          <table className="w-full border-collapse text-left">
            <thead>
              <tr>
                <th className="border-b border-border pb-2 text-xs font-bold uppercase text-secondary">Template</th>
                <th className="border-b border-border pb-2 text-xs font-bold uppercase text-secondary">Description</th>
                <th className="border-b border-border pb-2 text-right text-xs font-bold uppercase text-secondary">Operations</th>
              </tr>
            </thead>
            <tbody>
              {items.map((t) => (
                <StatusRow key={t.key} template={t} />
              ))}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  );
}

function SettingsTab() {
  const { data, isLoading } = useEmailTemplateSettings();
  const update = useUpdateEmailTemplateSettings();
  const [logoMediaId, setLogoMediaId] = useState<number | null | undefined>(undefined);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [contactEmail, setContactEmail] = useState<string | undefined>(undefined);
  const [copyright, setCopyright] = useState<string | undefined>(undefined);
  const [logoHeight, setLogoHeight] = useState<number | undefined>(undefined);
  const [customCss, setCustomCss] = useState<string | undefined>(undefined);

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  const effectiveLogoUrl = logoUrl !== undefined ? logoUrl : (data.logoUrl ?? undefined);

  function handleSave() {
    update.mutate({
      logoMediaId: logoMediaId !== undefined ? logoMediaId : undefined,
      contactEmail: contactEmail !== undefined ? contactEmail : undefined,
      copyright: copyright !== undefined ? copyright : undefined,
      logoHeight: logoHeight !== undefined ? logoHeight : undefined,
      customCss: customCss !== undefined ? customCss : undefined,
    });
  }

  return (
    <Card className="flex flex-col gap-4">
      <MediaPicker
        label="Logo"
        value={effectiveLogoUrl}
        onChange={(url) => {
          setLogoUrl(url);
          // Remove button calls onChange("") without onSelectMedia, so this
          // is the only signal that the logo was cleared — null it out here.
          // Non-empty URLs (fresh upload / library pick) are handled by
          // onSelectMedia, which fires synchronously alongside onChange.
          if (url === "") setLogoMediaId(null);
        }}
        onSelectMedia={(media) => setLogoMediaId(media.id)}
      />
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Contact email address</span>
        <input
          value={contactEmail !== undefined ? contactEmail : data.contactEmail}
          onChange={(e) => setContactEmail(e.target.value)}
          placeholder="e.g: example@domain.com"
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Copyright</span>
        <input
          value={copyright !== undefined ? copyright : data.copyright}
          onChange={(e) => setCopyright(e.target.value)}
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Logo height (px)</span>
        <input
          type="number"
          value={logoHeight !== undefined ? logoHeight : data.logoHeight}
          onChange={(e) => setLogoHeight(Number(e.target.value))}
          className="h-10 w-32 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Email template custom CSS</span>
        <textarea
          value={customCss !== undefined ? customCss : data.customCss}
          onChange={(e) => setCustomCss(e.target.value)}
          rows={6}
          spellCheck={false}
          className="rounded-sm border border-border bg-surface p-3 font-mono text-xs text-text outline-none focus:border-brand-500"
        />
      </label>
      <div>
        <Button type="button" variant="primary" disabled={update.isPending} onClick={handleSave}>
          {update.isPending ? "Saving…" : "Save settings"}
        </Button>
      </div>
    </Card>
  );
}

export default function EmailTemplatesPage() {
  const [tab, setTab] = useState<"templates" | "status" | "settings">("templates");
  const { data: templates, isLoading } = useEmailTemplates();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader icon={emailIcon} title="Email Templates" subtitle="Email templates using HTML & system variables." style={gradientStyle} />
      <Link href="/settings" className="flex items-center gap-1.5 text-sm font-semibold text-brand-500">
        <Icon name="arrow_back" size={16} /> Back to Settings
      </Link>

      <Tabs
        options={[
          { value: "templates", label: "Email Templates" },
          { value: "status", label: "Email Template Status" },
          { value: "settings", label: "Email Template Settings" },
        ]}
        value={tab}
        onChange={(v) => setTab(v as typeof tab)}
      />

      {isLoading || !templates ? (
        <Card><p className="text-sm text-muted">Loading…</p></Card>
      ) : (
        <>
          {tab === "templates" && <TemplatesTab templates={templates} />}
          {tab === "status" && <StatusTab templates={templates} />}
        </>
      )}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
