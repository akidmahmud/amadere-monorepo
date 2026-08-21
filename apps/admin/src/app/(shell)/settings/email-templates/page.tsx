"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card, Icon, PageHeader, Tabs, ToggleSwitch } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { useToast } from "@/components/ToastProvider";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import {
  useEmailTemplates,
  useImportEmailTemplates,
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

// Plain navigation to the proxy URL, which forwards the backend's
// Content-Disposition. The browser then handles it as an ordinary download:
// correct filename, appears in the download manager, "Show in folder" works.
// The previous Blob + object-URL approach did none of those reliably.
// Auth rides along because the proxy attaches the Bearer from the httpOnly
// cookie server-side — a direct link to the backend could not.
function downloadTemplates(keys?: string[]) {
  const qs = keys && keys.length > 0 ? `?keys=${encodeURIComponent(keys.join(","))}` : "";
  window.location.href = `/api/backend/admin/email-templates/export${qs}`;
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
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => downloadTemplates([t.key])}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-inner border border-border text-secondary hover:text-brand-500"
                        aria-label={`Export ${t.title}`}
                        title={`Export ${t.title}`}
                      >
                        <Icon name="download" size={16} />
                      </button>
                      <Link
                        href={`/settings/email-templates/${t.key}`}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-inner bg-brand-500 text-white"
                        aria-label={`Edit ${t.title}`}
                      >
                        <Icon name="edit" size={16} />
                      </Link>
                    </div>
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
  const toast = useToast();
  const { data, isLoading } = useEmailTemplateSettings();
  const update = useUpdateEmailTemplateSettings();
  const [logoMediaId, setLogoMediaId] = useState<number | null | undefined>(undefined);
  const [logoUrl, setLogoUrl] = useState<string | undefined>(undefined);
  const [contactEmail, setContactEmail] = useState<string | undefined>(undefined);
  const [copyright, setCopyright] = useState<string | undefined>(undefined);
  const [logoHeight, setLogoHeight] = useState<number | undefined>(undefined);
  const [customCss, setCustomCss] = useState<string | undefined>(undefined);
  const [orderNotificationEmail, setOrderNotificationEmail] = useState<string | undefined>(undefined);

  if (isLoading || !data) return <Card><p className="text-sm text-muted">Loading…</p></Card>;

  const effectiveLogoUrl = logoUrl !== undefined ? logoUrl : (data.logoUrl ?? undefined);

  async function handleSave() {
    try {
      await update.mutateAsync({
        logoMediaId: logoMediaId !== undefined ? logoMediaId : undefined,
        contactEmail: contactEmail !== undefined ? contactEmail : undefined,
        copyright: copyright !== undefined ? copyright : undefined,
        logoHeight: logoHeight !== undefined ? logoHeight : undefined,
        customCss: customCss !== undefined ? customCss : undefined,
        orderNotificationEmail: orderNotificationEmail !== undefined ? orderNotificationEmail : undefined,
      });
      toast.push("Email template settings saved.", "success");
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to save settings", "error");
    }
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
        <span className="text-xs font-semibold text-secondary">Order notification email</span>
        <input
          value={orderNotificationEmail !== undefined ? orderNotificationEmail : data.orderNotificationEmail}
          onChange={(e) => setOrderNotificationEmail(e.target.value)}
          placeholder="e.g: orders@yourstore.com"
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
        <span className="text-xs text-muted">
          Who gets notified when a new order comes in. Falls back to Contact Email, then the SMTP sender address, if left blank.
        </span>
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

// Export downloads every template as one JSON file; Import reads that file
// back. The point is moving templates between environments — e.g. designing
// one locally and getting it onto production without a SQL seed.
function ImportExportBar() {
  const importTemplates = useImportEmailTemplates();
  const toast = useToast();
  const [overwrite, setOverwrite] = useState(false);
  const [pasted, setPasted] = useState("");

  function runImport(raw: string, sourceLabel: string) {
    let parsed: { templates?: unknown };
    try {
      parsed = JSON.parse(raw);
    } catch {
      toast.push(`That ${sourceLabel} isn't valid JSON.`, "error");
      return;
    }
    const templates = parsed?.templates;
    if (!Array.isArray(templates) || templates.length === 0) {
      toast.push(`No templates found in that ${sourceLabel} — expected a { "templates": [...] } export.`, "error");
      return;
    }
    importTemplates.mutate(
      { templates: templates as Record<string, unknown>[], overwriteExisting: overwrite },
      {
        onSuccess: (r) => {
          const parts = [
            r.created.length ? `${r.created.length} added` : null,
            r.updated.length ? `${r.updated.length} replaced` : null,
            // Named explicitly: "skipped" with the reason is the difference
            // between "nothing happened" and "these already existed and you
            // didn't ask to replace them".
            r.skipped.length ? `${r.skipped.length} skipped (already exist)` : null,
          ].filter(Boolean);
          toast.push(parts.length ? `Import complete — ${parts.join(", ")}.` : "Nothing to import.", "success");
          setPasted("");
        },
        onError: (e) => toast.push(e instanceof Error ? e.message : "Import failed", "error"),
      },
    );
  }

  return (
    <Card className="flex flex-wrap items-center gap-3">
      <div className="mr-auto">
        <p className="text-sm font-semibold text-text">Import / Export</p>
        <p className="text-xs text-muted">
          Download every template as a JSON file, or restore one — useful for copying templates to another
          environment.
        </p>
      </div>

      <label className="flex items-center gap-2 text-xs font-semibold text-secondary">
        <input type="checkbox" checked={overwrite} onChange={(e) => setOverwrite(e.target.checked)} />
        Replace templates that already exist
      </label>

      {/* A real <label> wrapping the input, rather than a hidden input driven
          by fileRef.current.click(). The programmatic version depends on the
          browser honouring a synthetic click on a display:none input, which
          some environments (extensions, hardened policies) simply drop —
          leaving the button looking dead. A label is the native mechanism and
          needs no JavaScript at all. */}
      <label
        className={`inline-flex h-10 cursor-pointer items-center rounded-sm border border-border px-3.5 text-sm font-semibold text-secondary hover:text-brand-500 ${
          importTemplates.isPending ? "pointer-events-none opacity-60" : ""
        }`}
      >
        {importTemplates.isPending ? "Importing…" : "Import file"}
        <input
          type="file"
          accept="application/json,.json"
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            // Reset first so re-picking the same file fires change again.
            e.target.value = "";
            if (file) void file.text().then((t) => runImport(t, "file"));
          }}
        />
      </label>
      <Button type="button" variant="primary" onClick={() => downloadTemplates()}>
        Export all
      </Button>

      {/* Paste path — needs neither a download nor a file dialog, so it also
          covers "someone sent me a template in chat" without a round trip
          through the filesystem. */}
      <div className="w-full">
        <textarea
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          rows={3}
          placeholder='Or paste exported JSON here — { "templates": [ ... ] }'
          className="w-full rounded-sm border border-border bg-surface px-3 py-2 font-mono text-xs text-text outline-none focus:border-brand-500"
        />
        <div className="mt-2 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            disabled={!pasted.trim() || importTemplates.isPending}
            onClick={() => runImport(pasted, "pasted JSON")}
          >
            {importTemplates.isPending ? "Importing…" : "Import pasted JSON"}
          </Button>
        </div>
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
          {tab === "templates" && (
            <>
              <ImportExportBar />
              <TemplatesTab templates={templates} />
            </>
          )}
          {tab === "status" && <StatusTab templates={templates} />}
        </>
      )}
      {tab === "settings" && <SettingsTab />}
    </div>
  );
}
