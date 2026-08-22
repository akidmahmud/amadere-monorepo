"use client";

import { useEffect, useState, useMemo } from "react";
import { Button, Card, Icon, PageHeader, Tabs } from "@amader/admin-ui";
import { Footer as PublicFooter, type FooterProps as PublicFooterProps } from "@amader/ui";
import {
  FOOTER_APP_STYLES,
  FOOTER_MAX_APP_BUTTONS,
  FOOTER_MAX_COLUMNS,
  FOOTER_MAX_SOCIAL,
  FOOTER_SOCIAL_ICONS,
} from "@amader/shared";
import { MediaPicker } from "@/components/MediaPicker";
import { RichTextEditor } from "@/components/RichTextEditor";
import { PreviewFrame } from "@/components/PreviewFrame";
import { useFooter, useMediaUrls, useUpdateFooter, type FooterConfig } from "@/hooks/useFooter";

type Translated = { en: string; bn: string };
type FooterSocial = FooterConfig["social"][number];
type FooterAppButton = FooterConfig["apps"]["buttons"][number];
type FooterColumn = FooterConfig["columns"][number];
type FooterLink = FooterColumn["links"][number];

type LangMode = "both" | "en" | "bn";
type ViewMode = "editor" | "split" | "preview";
type PreviewDevice = "desktop" | "mobile";

function updateAt<T>(arr: T[], index: number, next: T): T[] {
  const copy = arr.slice();
  copy[index] = next;
  return copy;
}

function removeAt<T>(arr: T[], index: number): T[] {
  return arr.filter((_, i) => i !== index);
}

function moveAt<T>(arr: T[], index: number, dir: -1 | 1): T[] {
  const target = index + dir;
  if (target < 0 || target >= arr.length) return arr;
  const copy = arr.slice();
  [copy[index], copy[target]] = [copy[target], copy[index]];
  return copy;
}

function ActionIconButton({
  icon,
  label,
  onClick,
  disabled = false,
  danger = false,
}: {
  icon: string;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition-colors ${
        disabled
          ? "border-transparent text-muted/30 cursor-not-allowed"
          : danger
            ? "border-red-200 bg-red-50/40 text-red-600 hover:bg-red-100 hover:border-red-300 dark:border-red-900/40 dark:bg-red-950/30 dark:text-red-400 dark:hover:bg-red-900/50"
            : "border-border bg-surface text-secondary hover:bg-surface-2 hover:text-text"
      }`}
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

function RowActions({
  index,
  count,
  onRemove,
  onMove,
}: {
  index: number;
  count: number;
  onRemove: () => void;
  onMove: (dir: -1 | 1) => void;
}) {
  return (
    <div className="flex items-center gap-1 shrink-0">
      <ActionIconButton
        icon="arrow_upward"
        label="Move Up"
        disabled={index === 0}
        onClick={() => onMove(-1)}
      />
      <ActionIconButton
        icon="arrow_downward"
        label="Move Down"
        disabled={index === count - 1}
        onClick={() => onMove(1)}
      />
      <ActionIconButton
        icon="delete"
        label="Delete"
        danger
        onClick={onRemove}
      />
    </div>
  );
}

function TranslatedField({
  label,
  value,
  onChange,
  multiline = false,
  langMode = "both",
  placeholder,
  helperText,
}: {
  label: string;
  value: Translated;
  onChange: (next: Translated) => void;
  multiline?: boolean;
  langMode?: LangMode;
  placeholder?: { en?: string; bn?: string };
  helperText?: string;
}) {
  const InputComponent = multiline ? "textarea" : "input";
  const inputBaseStyle =
    "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text transition-all duration-150 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-semibold text-text">{label}</span>}
      <div className={`grid gap-3 ${langMode === "both" ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {(langMode === "both" || langMode === "bn") && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold">BN</span>
                বাংলা
              </span>
            </div>
            <InputComponent
              className={inputBaseStyle}
              rows={multiline ? 3 : undefined}
              value={value.bn || ""}
              placeholder={placeholder?.bn || "বাংলা বিবরণ..."}
              onChange={(e) => onChange({ ...value, bn: e.target.value })}
            />
          </div>
        )}

        {(langMode === "both" || langMode === "en") && (
          <div className="flex flex-col gap-1">
            <div className="flex items-center justify-between text-xs">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
                <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold">EN</span>
                English
              </span>
            </div>
            <InputComponent
              className={inputBaseStyle}
              rows={multiline ? 3 : undefined}
              value={value.en || ""}
              placeholder={placeholder?.en || "English description..."}
              onChange={(e) => onChange({ ...value, en: e.target.value })}
            />
          </div>
        )}
      </div>
      {helperText && <p className="text-[11px] text-muted">{helperText}</p>}
    </div>
  );
}

/** Same BN/EN split as TranslatedField, but each side is a CKEditor instance
 * instead of a plain input -- the footer description is rich text. The
 * storefront sanitizes the HTML before rendering it (see SiteFooter). */
function TranslatedRichTextField({
  label,
  value,
  onChange,
  langMode = "both",
  helperText,
}: {
  label: string;
  value: Translated;
  onChange: (next: Translated) => void;
  langMode?: LangMode;
  helperText?: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="text-xs font-semibold text-text">{label}</span>}
      <div className={`grid gap-3 ${langMode === "both" ? "md:grid-cols-2" : "grid-cols-1"}`}>
        {(langMode === "both" || langMode === "bn") && (
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
              <span className="rounded bg-emerald-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold">BN</span>
              BN
            </span>
            <RichTextEditor compact value={value.bn || ""} onChange={(html) => onChange({ ...value, bn: html })} />
          </div>
        )}
        {(langMode === "both" || langMode === "en") && (
          <div className="flex flex-col gap-1">
            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-600 dark:text-indigo-400">
              <span className="rounded bg-indigo-500/15 px-1.5 py-0.5 font-mono text-[10px] font-bold">EN</span>
              English
            </span>
            <RichTextEditor compact value={value.en || ""} onChange={(html) => onChange({ ...value, en: html })} />
          </div>
        )}
      </div>
      {helperText && <p className="text-[11px] text-muted">{helperText}</p>}
    </div>
  );
}

function newSocial(): FooterSocial {
  return { icon: "facebook", mediaId: null, url: "", label: { en: "", bn: "" } };
}

function newAppButton(): FooterAppButton {
  return {
    style: "googlePlay",
    mediaId: null,
    url: "",
    lineOne: { en: "Get it on", bn: "ডাউনলোড করুন" },
    lineTwo: { en: "Google Play", bn: "Google Play" },
  };
}

function newColumn(): FooterColumn {
  return { heading: { en: "Quick Links", bn: "প্রয়োজনীয় লিংক" }, links: [] };
}

function newLink(): FooterLink {
  return { label: { en: "New Link", bn: "নতুন লিংক" }, href: "/", newTab: false };
}

function getPublicFooterProps(
  draft: FooterConfig,
  pickedMediaUrls: Record<string, string>,
  lang: "en" | "bn" = "en"
): PublicFooterProps {
  return {
    brandMark: draft.brandMark[lang] || draft.brandMark.en || draft.brandMark.bn || "",
    description: draft.description[lang] || draft.description.en || draft.description.bn || "",
    address: draft.contact.address.value[lang] || draft.contact.address.value.en || "",
    phone: draft.contact.phone.value || "",
    email: draft.contact.email.value || "",
    workingHours: draft.contact.hours.value[lang] || draft.contact.hours.value.en || "",
    social: draft.social.map((s, idx) => ({
      icon: s.icon,
      imageUrl: s.icon === "custom" ? pickedMediaUrls[`social:${idx}`] || null : null,
      url: s.url,
      label: s.label[lang] || s.label.en || s.icon,
    })),
    appButtons: draft.apps.buttons.map((b, idx) => ({
      style: b.style,
      imageUrl: b.style === "custom" ? pickedMediaUrls[`app:${idx}`] || null : null,
      url: b.url,
      lineOne: b.lineOne[lang] || b.lineOne.en || "",
      lineTwo: b.lineTwo[lang] || b.lineTwo.en || "",
    })),
    appDownloadLabel: draft.apps.downloadLabel[lang] || draft.apps.downloadLabel.en || "",
    columns: draft.columns.map((c) => ({
      heading: c.heading[lang] || c.heading.en || "",
      links: c.links.map((l) => ({
        label: l.label[lang] || l.label.en || "",
        href: l.href,
        newTab: l.newTab,
      })),
    })),
    copyrightLabel: (draft.copyright[lang] || draft.copyright.en || "").replace(
      "{year}",
      new Date().getFullYear().toString()
    ),
    payWithLabel: draft.payment.label[lang] || draft.payment.label.en || "",
    paymentImageUrl: pickedMediaUrls.payment || undefined,
    // Preview only: with no footer logo chosen, Footer falls back to the
    // brand-mark text here. On the real storefront it falls back to the
    // site logo, which this admin page does not load.
    logoUrl: draft.logo.mediaId ? pickedMediaUrls.logo || undefined : undefined,
  };
}

export default function FooterPage() {
  const { data, isLoading } = useFooter();
  const update = useUpdateFooter();
  const [draft, setDraft] = useState<FooterConfig | null>(null);
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [pickedMediaUrls, setPickedMediaUrls] = useState<Record<string, string>>({});

  // Active Management Tab
  const [activeTab, setActiveTab] = useState<string>("general");
  // Language view filter: "both" | "en" | "bn"
  const [langMode, setLangMode] = useState<LangMode>("both");
  // Layout view mode: "editor" | "split" | "preview"
  const [viewMode, setViewMode] = useState<ViewMode>("editor");
  // Live Preview settings
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [previewLang, setPreviewLang] = useState<"en" | "bn">("en");

  // Track expanded column items
  const [expandedColumns, setExpandedColumns] = useState<Record<number, boolean>>({});

  // Every mediaId the saved config references, so their URLs can be resolved
  // for the pickers and the preview. Read from `data` (the server copy) not
  // `draft`, so editing does not refire the lookup on every keystroke.
  const storedMediaIds = useMemo(() => {
    if (!data) return [];
    return [
      ...data.social.map((s) => s.mediaId),
      ...data.apps.buttons.map((b) => b.mediaId),
      data.payment.mediaId,
      data.logo.mediaId,
    ].filter((id): id is number => typeof id === "number");
  }, [data]);
  const { data: mediaUrlById } = useMediaUrls(storedMediaIds);

  // Seed the slot-keyed picker state once the URLs arrive. Only fills slots
  // that are still empty, so a URL the admin just picked in this session is
  // never clobbered by the resolved one.
  useEffect(() => {
    if (!data || !mediaUrlById) return;
    const seeded: Record<string, string> = {};
    data.social.forEach((s, idx) => {
      const url = s.mediaId ? mediaUrlById[s.mediaId] : undefined;
      if (url) seeded[`social:${idx}`] = url;
    });
    data.apps.buttons.forEach((b, idx) => {
      const url = b.mediaId ? mediaUrlById[b.mediaId] : undefined;
      if (url) seeded[`app:${idx}`] = url;
    });
    const paymentUrl = data.payment.mediaId ? mediaUrlById[data.payment.mediaId] : undefined;
    if (paymentUrl) seeded.payment = paymentUrl;
    const logoUrl = data.logo.mediaId ? mediaUrlById[data.logo.mediaId] : undefined;
    if (logoUrl) seeded.logo = logoUrl;
    if (Object.keys(seeded).length === 0) return;
    setPickedMediaUrls((prev) => ({ ...seeded, ...prev }));
  }, [data, mediaUrlById]);

  useEffect(() => {
    if (data && !draft) {
      setDraft(structuredClone(data));
      // Auto-expand all columns initially
      if (data.columns) {
        const initExpand: Record<number, boolean> = {};
        data.columns.forEach((_, idx) => {
          initExpand[idx] = true;
        });
        setExpandedColumns(initExpand);
      }
    }
  }, [data, draft]);

  const hasChanges = useMemo(() => {
    if (!data || !draft) return false;
    return JSON.stringify(data) !== JSON.stringify(draft);
  }, [data, draft]);

  if (isLoading || !draft) {
    return (
      <Card className="flex items-center justify-center p-12">
        <div className="flex items-center gap-3 text-muted">
          <Icon name="progress_activity" className="animate-spin" size={24} />
          <span className="text-sm font-medium">Loading Footer configuration…</span>
        </div>
      </Card>
    );
  }

  async function handleSave() {
    if (!draft) return;
    setSaveError(null);
    try {
      await update.mutateAsync(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Couldn't save the footer");
    }
  }

  function toggleColumnExpand(colIndex: number) {
    setExpandedColumns((prev) => ({ ...prev, [colIndex]: !prev[colIndex] }));
  }

  const publicProps = getPublicFooterProps(draft, pickedMediaUrls, previewLang);

  const navTabOptions = [
    { value: "general", label: "General & Contact" },
    { value: "columns", label: `Link Columns (${draft.columns.length}/${FOOTER_MAX_COLUMNS})` },
    { value: "social", label: `Social & Apps (${draft.social.length + draft.apps.buttons.length})` },
    { value: "payment", label: "Payment & Copyright" },
    { value: "preview", label: "Live Preview" },
  ];

  return (
    <div className="flex flex-col gap-5 pb-16">
      {/* Page Header Bar */}
      <PageHeader
        title="Footer Settings"
        actions={
          <div className="flex flex-wrap items-center gap-3">
            {/* Save Status indicator */}
            {saved && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                <Icon name="check_circle" size={16} /> Saved successfully
              </span>
            )}
            {hasChanges && !saved && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
                <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" /> Unsaved changes
              </span>
            )}
            {saveError && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-500/10 px-3 py-1 text-xs font-semibold text-red-600 dark:text-red-400">
                <Icon name="error" size={16} /> {saveError}
              </span>
            )}

            {/* View Mode Switcher */}
            <div className="hidden sm:flex items-center rounded-md border border-border bg-surface p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setViewMode("editor")}
                className={`flex items-center gap-1 rounded-sm px-2.5 py-1.5 font-medium transition-colors ${
                  viewMode === "editor"
                    ? "bg-brand-500 text-white font-semibold shadow-xs"
                    : "text-muted hover:text-text"
                }`}
              >
                <Icon name="edit" size={16} /> Editor
              </button>
              <button
                type="button"
                onClick={() => setViewMode("split")}
                className={`flex items-center gap-1 rounded-sm px-2.5 py-1.5 font-medium transition-colors ${
                  viewMode === "split"
                    ? "bg-brand-500 text-white font-semibold shadow-xs"
                    : "text-muted hover:text-text"
                }`}
              >
                <Icon name="vertical_split" size={16} /> Split
              </button>
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`flex items-center gap-1 rounded-sm px-2.5 py-1.5 font-medium transition-colors ${
                  viewMode === "preview"
                    ? "bg-brand-500 text-white font-semibold shadow-xs"
                    : "text-muted hover:text-text"
                }`}
              >
                <Icon name="preview" size={16} /> Preview
              </button>
            </div>

            <Button onClick={handleSave} disabled={update.isPending || !hasChanges}>
              {update.isPending ? "Saving…" : "Save Footer"}
            </Button>
          </div>
        }
      />

      {/* Control Bar: Language Filter & Section Tabs */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between border-b border-border pb-3">
        <Tabs options={navTabOptions} value={activeTab} onChange={setActiveTab} />

        {/* Language Input Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-medium text-muted flex items-center gap-1">
            <Icon name="language" size={16} /> Field Language:
          </span>
          <div className="flex items-center rounded-md border border-border bg-surface p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setLangMode("both")}
              className={`rounded-sm px-2 py-1 font-medium transition-colors ${
                langMode === "both" ? "bg-brand-500 text-white font-semibold" : "text-muted hover:text-text"
              }`}
            >
              Both
            </button>
            <button
              type="button"
              onClick={() => setLangMode("en")}
              className={`rounded-sm px-2 py-1 font-medium transition-colors ${
                langMode === "en" ? "bg-indigo-600 text-white font-semibold" : "text-muted hover:text-text"
              }`}
            >
              EN Only
            </button>
            <button
              type="button"
              onClick={() => setLangMode("bn")}
              className={`rounded-sm px-2 py-1 font-medium transition-colors ${
                langMode === "bn" ? "bg-emerald-600 text-white font-semibold" : "text-muted hover:text-text"
              }`}
            >
              BN Only
            </button>
          </div>
        </div>
      </div>

      {/* Main Layout Area */}
      <div
        className={`grid gap-6 ${
          viewMode === "split" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
        }`}
      >
        {/* Editor Form Column */}
        {viewMode !== "preview" && (
          <div className="flex flex-col gap-6">
            {/* TAB 1: GENERAL & CONTACT */}
            {activeTab === "general" && (
              <>
                <Card className="flex flex-col gap-5 p-5">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <Icon name="storefront" className="text-brand-500" size={22} />
                    <div>
                      <h3 className="text-base font-bold text-text">Brand & Description</h3>
                      <p className="text-xs text-muted">Set the brand mark name and summary description</p>
                    </div>
                  </div>

                  <TranslatedField
                    label="Brand Mark / Store Name"
                    value={draft.brandMark}
                    langMode={langMode}
                    placeholder={{ en: "Amader Store", bn: "আমাদের স্টোর" }}
                    onChange={(next) => setDraft({ ...draft, brandMark: next })}
                  />

                  <TranslatedRichTextField
                    label="Footer Description"
                    value={draft.description}
                    langMode={langMode}
                    helperText="Rich text - bold, links and lists are preserved. Keep it short; this sits beside the logo."
                    onChange={(next) => setDraft({ ...draft, description: next })}
                  />

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-text">Footer Logo</span>
                    <MediaPicker
                      label="Select Footer Logo"
                      value={pickedMediaUrls.logo}
                      onChange={() => {}}
                      onSelectMedia={(media) => {
                        setDraft({ ...draft, logo: { mediaId: media.id } });
                        setPickedMediaUrls((prev) => ({ ...prev, logo: media.fullUrl ?? media.url }));
                      }}
                    />
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-[11px] text-muted">
                        Optional. Leave empty to keep using the site logo from Settings.
                      </p>
                      {draft.logo.mediaId !== null && (
                        <button
                          type="button"
                          className="shrink-0 text-[11px] font-semibold text-red-600 underline hover:text-red-700"
                          onClick={() => {
                            setDraft({ ...draft, logo: { mediaId: null } });
                            setPickedMediaUrls((prev) => {
                              const next = { ...prev };
                              delete next.logo;
                              return next;
                            });
                          }}
                        >
                          Use site logo instead
                        </button>
                      )}
                    </div>
                  </div>
                </Card>

                <Card className="flex flex-col gap-5 p-5">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <Icon name="contact_phone" className="text-brand-500" size={22} />
                    <div>
                      <h3 className="text-base font-bold text-text">Contact Information</h3>
                      <p className="text-xs text-muted">Customer support address, phone, email, and office hours</p>
                    </div>
                  </div>

                  {/* Address */}
                  <div className="rounded-lg border border-border/80 bg-surface/50 p-4 flex flex-col gap-3">
                    <span className="text-xs font-bold text-secondary uppercase tracking-wider">Address</span>
                    <TranslatedField
                      label="Label"
                      value={draft.contact.address.label}
                      langMode={langMode}
                      onChange={(next) =>
                        setDraft({
                          ...draft,
                          contact: { ...draft.contact, address: { ...draft.contact.address, label: next } },
                        })
                      }
                    />
                    <TranslatedField
                      label="Value"
                      value={draft.contact.address.value}
                      langMode={langMode}
                      onChange={(next) =>
                        setDraft({
                          ...draft,
                          contact: { ...draft.contact, address: { ...draft.contact.address, value: next } },
                        })
                      }
                    />
                  </div>

                  {/* Phone */}
                  <div className="rounded-lg border border-border/80 bg-surface/50 p-4 flex flex-col gap-3">
                    <span className="text-xs font-bold text-secondary uppercase tracking-wider">Phone</span>
                    <TranslatedField
                      label="Label"
                      value={draft.contact.phone.label}
                      langMode={langMode}
                      onChange={(next) =>
                        setDraft({
                          ...draft,
                          contact: { ...draft.contact, phone: { ...draft.contact.phone, label: next } },
                        })
                      }
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-text">Phone Number (Tap-to-call link)</span>
                      <input
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        value={draft.contact.phone.value}
                        placeholder="+880 1700-000000"
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            contact: { ...draft.contact, phone: { ...draft.contact.phone, value: e.target.value } },
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Email */}
                  <div className="rounded-lg border border-border/80 bg-surface/50 p-4 flex flex-col gap-3">
                    <span className="text-xs font-bold text-secondary uppercase tracking-wider">Email</span>
                    <TranslatedField
                      label="Label"
                      value={draft.contact.email.label}
                      langMode={langMode}
                      onChange={(next) =>
                        setDraft({
                          ...draft,
                          contact: { ...draft.contact, email: { ...draft.contact.email, label: next } },
                        })
                      }
                    />
                    <div className="flex flex-col gap-1">
                      <span className="text-xs font-semibold text-text">Email Address</span>
                      <input
                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                        value={draft.contact.email.value}
                        placeholder="support@example.com"
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            contact: { ...draft.contact, email: { ...draft.contact.email, value: e.target.value } },
                          })
                        }
                      />
                    </div>
                  </div>

                  {/* Hours */}
                  <div className="rounded-lg border border-border/80 bg-surface/50 p-4 flex flex-col gap-3">
                    <span className="text-xs font-bold text-secondary uppercase tracking-wider">Working Hours</span>
                    <TranslatedField
                      label="Label"
                      value={draft.contact.hours.label}
                      langMode={langMode}
                      onChange={(next) =>
                        setDraft({
                          ...draft,
                          contact: { ...draft.contact, hours: { ...draft.contact.hours, label: next } },
                        })
                      }
                    />
                    <TranslatedField
                      label="Value"
                      value={draft.contact.hours.value}
                      langMode={langMode}
                      onChange={(next) =>
                        setDraft({
                          ...draft,
                          contact: { ...draft.contact, hours: { ...draft.contact.hours, value: next } },
                        })
                      }
                    />
                  </div>
                </Card>
              </>
            )}

            {/* TAB 2: LINK COLUMNS */}
            {activeTab === "columns" && (
              <div className="flex flex-col gap-5">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-base font-bold text-text">Navigation Link Columns</h3>
                    <p className="text-xs text-muted">
                      Organize footer links into up to {FOOTER_MAX_COLUMNS} structured columns
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={draft.columns.length >= FOOTER_MAX_COLUMNS}
                    onClick={() => {
                      const newColIdx = draft.columns.length;
                      setDraft({ ...draft, columns: [...draft.columns, newColumn()] });
                      setExpandedColumns((prev) => ({ ...prev, [newColIdx]: true }));
                    }}
                  >
                    <Icon name="add" size={18} /> Add Column ({draft.columns.length}/{FOOTER_MAX_COLUMNS})
                  </Button>
                </div>

                {draft.columns.map((column, colIndex) => {
                  const isExpanded = expandedColumns[colIndex] ?? true;
                  const colHeading = column.heading.en || column.heading.bn || `Column ${colIndex + 1}`;

                  return (
                    <Card key={colIndex} className="flex flex-col gap-4 p-4 border border-border">
                      {/* Column Card Header Bar */}
                      <div className="flex items-center justify-between bg-surface-2/60 -mx-4 -mt-4 p-4 border-b border-border rounded-t-sm">
                        <button
                          type="button"
                          onClick={() => toggleColumnExpand(colIndex)}
                          className="flex items-center gap-2.5 text-left font-bold text-text hover:text-brand-500"
                        >
                          <Icon name={isExpanded ? "expand_more" : "chevron_right"} size={22} />
                          <span className="text-sm">Column {colIndex + 1}:</span>
                          <span className="text-sm font-semibold text-brand-500">{colHeading}</span>
                          <span className="rounded-full bg-border px-2 py-0.5 text-[11px] font-normal text-muted">
                            {column.links.length} links
                          </span>
                        </button>

                        <RowActions
                          index={colIndex}
                          count={draft.columns.length}
                          onRemove={() => setDraft({ ...draft, columns: removeAt(draft.columns, colIndex) })}
                          onMove={(dir) => setDraft({ ...draft, columns: moveAt(draft.columns, colIndex, dir) })}
                        />
                      </div>

                      {isExpanded && (
                        <div className="flex flex-col gap-4 pt-2">
                          <TranslatedField
                            label="Column Heading"
                            value={column.heading}
                            langMode={langMode}
                            onChange={(next) =>
                              setDraft({
                                ...draft,
                                columns: updateAt(draft.columns, colIndex, { ...column, heading: next }),
                              })
                            }
                          />

                          {/* Sub Links List */}
                          <div className="flex flex-col gap-3">
                            <span className="text-xs font-bold text-secondary">Column Links</span>

                            {column.links.length === 0 ? (
                              <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted">
                                No links added yet in this column.
                              </div>
                            ) : (
                              column.links.map((link, linkIndex) => (
                                <div
                                  key={linkIndex}
                                  className="flex flex-col gap-3 rounded-lg border border-border bg-surface/60 p-3.5 shadow-2xs"
                                >
                                  <div className="flex items-center justify-between border-b border-border/60 pb-2">
                                    <span className="text-xs font-semibold text-muted flex items-center gap-1.5">
                                      <Icon name="drag_indicator" size={16} className="text-muted/60" /> Link #{linkIndex + 1}
                                    </span>
                                    <RowActions
                                      index={linkIndex}
                                      count={column.links.length}
                                      onRemove={() =>
                                        setDraft({
                                          ...draft,
                                          columns: updateAt(draft.columns, colIndex, {
                                            ...column,
                                            links: removeAt(column.links, linkIndex),
                                          }),
                                        })
                                      }
                                      onMove={(dir) =>
                                        setDraft({
                                          ...draft,
                                          columns: updateAt(draft.columns, colIndex, {
                                            ...column,
                                            links: moveAt(column.links, linkIndex, dir),
                                          }),
                                        })
                                      }
                                    />
                                  </div>

                                  <TranslatedField
                                    label="Link Label"
                                    value={link.label}
                                    langMode={langMode}
                                    onChange={(next) =>
                                      setDraft({
                                        ...draft,
                                        columns: updateAt(draft.columns, colIndex, {
                                          ...column,
                                          links: updateAt(column.links, linkIndex, { ...link, label: next }),
                                        }),
                                      })
                                    }
                                  />

                                  <div className="grid gap-3 md:grid-cols-2 items-center">
                                    <div className="flex flex-col gap-1">
                                      <span className="text-xs font-semibold text-text">Target URL (Href)</span>
                                      <input
                                        className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                                        value={link.href}
                                        placeholder="/about-us or https://..."
                                        onChange={(e) =>
                                          setDraft({
                                            ...draft,
                                            columns: updateAt(draft.columns, colIndex, {
                                              ...column,
                                              links: updateAt(column.links, linkIndex, { ...link, href: e.target.value }),
                                            }),
                                          })
                                        }
                                      />
                                    </div>

                                    <label className="flex items-center gap-2 pt-5 text-xs font-semibold text-text cursor-pointer">
                                      <input
                                        type="checkbox"
                                        className="h-4 w-4 rounded border-border text-brand-500 focus:ring-brand-500"
                                        checked={link.newTab}
                                        onChange={(e) =>
                                          setDraft({
                                            ...draft,
                                            columns: updateAt(draft.columns, colIndex, {
                                              ...column,
                                              links: updateAt(column.links, linkIndex, { ...link, newTab: e.target.checked }),
                                            }),
                                          })
                                        }
                                      />
                                      Open link in a new browser tab
                                    </label>
                                  </div>
                                </div>
                              ))
                            )}

                            <Button
                              type="button"
                              variant="ghost"
                              className="mt-1 self-start"
                              onClick={() =>
                                setDraft({
                                  ...draft,
                                  columns: updateAt(draft.columns, colIndex, {
                                    ...column,
                                    links: [...column.links, newLink()],
                                  }),
                                })
                              }
                            >
                              <Icon name="add" size={16} /> Add Link to {colHeading}
                            </Button>
                          </div>
                        </div>
                      )}
                    </Card>
                  );
                })}
              </div>
            )}

            {/* TAB 3: SOCIAL & APP BUTTONS */}
            {activeTab === "social" && (
              <div className="flex flex-col gap-6">
                {/* Social Links Section */}
                <Card className="flex flex-col gap-5 p-5">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Icon name="share" className="text-brand-500" size={22} />
                      <div>
                        <h3 className="text-base font-bold text-text">Social Media Channels</h3>
                        <p className="text-xs text-muted">
                          Configure social media icons and links ({draft.social.length}/{FOOTER_MAX_SOCIAL} maximum)
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={draft.social.length >= FOOTER_MAX_SOCIAL}
                      onClick={() => setDraft({ ...draft, social: [...draft.social, newSocial()] })}
                    >
                      <Icon name="add" size={18} /> Add Social Link
                    </Button>
                  </div>

                  {draft.social.map((row, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface/60 p-4 shadow-2xs"
                    >
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-xs font-bold text-secondary flex items-center gap-2">
                          <span className="rounded bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-500 uppercase">
                            {row.icon}
                          </span>
                          Social Link #{index + 1}
                        </span>
                        <RowActions
                          index={index}
                          count={draft.social.length}
                          onRemove={() => setDraft({ ...draft, social: removeAt(draft.social, index) })}
                          onMove={(dir) => setDraft({ ...draft, social: moveAt(draft.social, index, dir) })}
                        />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-text">Icon Style</span>
                          <select
                            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            value={row.icon}
                            onChange={(e) => {
                              const icon = e.target.value as FooterSocial["icon"];
                              setDraft({
                                ...draft,
                                social: updateAt(draft.social, index, {
                                  ...row,
                                  icon,
                                  mediaId: icon === "custom" ? row.mediaId : null,
                                }),
                              });
                            }}
                          >
                            {FOOTER_SOCIAL_ICONS.map((icon) => (
                              <option key={icon} value={icon}>
                                {icon.charAt(0).toUpperCase() + icon.slice(1)}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-text">Profile URL</span>
                          <input
                            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            value={row.url}
                            placeholder="https://facebook.com/..."
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                social: updateAt(draft.social, index, { ...row, url: e.target.value }),
                              })
                            }
                          />
                        </div>
                      </div>

                      <TranslatedField
                        label="Accessible Label (Aria)"
                        value={row.label}
                        langMode={langMode}
                        placeholder={{ en: "Follow us on Facebook", bn: "ফেসবুকে আমাদের ফলো করুন" }}
                        onChange={(next) =>
                          setDraft({ ...draft, social: updateAt(draft.social, index, { ...row, label: next }) })
                        }
                      />

                      {row.icon === "custom" && (
                        <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3 bg-surface">
                          <MediaPicker
                            label="Custom Icon Image"
                            value={pickedMediaUrls[`social:${index}`]}
                            onChange={() => {}}
                            onSelectMedia={(media) => {
                              setDraft({ ...draft, social: updateAt(draft.social, index, { ...row, mediaId: media.id }) });
                              setPickedMediaUrls((prev) => ({ ...prev, [`social:${index}`]: media.fullUrl ?? media.url }));
                            }}
                          />
                          <p className="text-xs text-muted">
                            Upload a square, transparent icon image.
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </Card>

                {/* App Download Buttons Section */}
                <Card className="flex flex-col gap-5 p-5">
                  <div className="flex items-center justify-between border-b border-border pb-3">
                    <div className="flex items-center gap-2">
                      <Icon name="smartphone" className="text-brand-500" size={22} />
                      <div>
                        <h3 className="text-base font-bold text-text">Mobile App Download Buttons</h3>
                        <p className="text-xs text-muted">
                          Configure mobile app store buttons ({draft.apps.buttons.length}/{FOOTER_MAX_APP_BUTTONS} max)
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      disabled={draft.apps.buttons.length >= FOOTER_MAX_APP_BUTTONS}
                      onClick={() =>
                        setDraft({ ...draft, apps: { ...draft.apps, buttons: [...draft.apps.buttons, newAppButton()] } })
                      }
                    >
                      <Icon name="add" size={18} /> Add App Button
                    </Button>
                  </div>

                  <TranslatedField
                    label="App Download Section Title"
                    value={draft.apps.downloadLabel}
                    langMode={langMode}
                    placeholder={{ en: "Download Our App", bn: "আমাদের অ্যাপ ডাউনলোড করুন" }}
                    onChange={(next) => setDraft({ ...draft, apps: { ...draft.apps, downloadLabel: next } })}
                  />

                  {draft.apps.buttons.map((row, index) => (
                    <div
                      key={index}
                      className="flex flex-col gap-3.5 rounded-lg border border-border bg-surface/60 p-4 shadow-2xs"
                    >
                      <div className="flex items-center justify-between border-b border-border/60 pb-2">
                        <span className="text-xs font-bold text-secondary flex items-center gap-2">
                          <span className="rounded bg-indigo-500/10 px-2 py-0.5 text-[11px] font-semibold text-indigo-600 uppercase">
                            {row.style}
                          </span>
                          App Store Button #{index + 1}
                        </span>
                        <RowActions
                          index={index}
                          count={draft.apps.buttons.length}
                          onRemove={() =>
                            setDraft({ ...draft, apps: { ...draft.apps, buttons: removeAt(draft.apps.buttons, index) } })
                          }
                          onMove={(dir) =>
                            setDraft({ ...draft, apps: { ...draft.apps, buttons: moveAt(draft.apps.buttons, index, dir) } })
                          }
                        />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-text">Store Badge Style</span>
                          <select
                            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            value={row.style}
                            onChange={(e) => {
                              const style = e.target.value as FooterAppButton["style"];
                              setDraft({
                                ...draft,
                                apps: {
                                  ...draft.apps,
                                  buttons: updateAt(draft.apps.buttons, index, {
                                    ...row,
                                    style,
                                    mediaId: style === "custom" ? row.mediaId : null,
                                  }),
                                },
                              });
                            }}
                          >
                            {FOOTER_APP_STYLES.map((style) => (
                              <option key={style} value={style}>
                                {style}
                              </option>
                            ))}
                          </select>
                        </div>

                        <div className="flex flex-col gap-1">
                          <span className="text-xs font-semibold text-text">App Store URL</span>
                          <input
                            className="w-full rounded-md border border-border bg-surface px-3 py-2 text-sm text-text focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20"
                            value={row.url}
                            placeholder="https://play.google.com/store/apps/..."
                            onChange={(e) =>
                              setDraft({
                                ...draft,
                                apps: {
                                  ...draft.apps,
                                  buttons: updateAt(draft.apps.buttons, index, { ...row, url: e.target.value }),
                                },
                              })
                            }
                          />
                        </div>
                      </div>

                      <TranslatedField
                        label="Top Small Text Line"
                        value={row.lineOne}
                        langMode={langMode}
                        placeholder={{ en: "Get it on", bn: "ডাউনলোড করুন" }}
                        onChange={(next) =>
                          setDraft({
                            ...draft,
                            apps: { ...draft.apps, buttons: updateAt(draft.apps.buttons, index, { ...row, lineOne: next }) },
                          })
                        }
                      />

                      <TranslatedField
                        label="Main Store Text Line"
                        value={row.lineTwo}
                        langMode={langMode}
                        placeholder={{ en: "Google Play", bn: "Google Play" }}
                        onChange={(next) =>
                          setDraft({
                            ...draft,
                            apps: { ...draft.apps, buttons: updateAt(draft.apps.buttons, index, { ...row, lineTwo: next }) },
                          })
                        }
                      />

                      {row.style === "custom" && (
                        <div className="flex flex-col gap-2 rounded-md border border-dashed border-border p-3 bg-surface">
                          <MediaPicker
                            label="Custom Store Icon"
                            value={pickedMediaUrls[`app:${index}`]}
                            onChange={() => {}}
                            onSelectMedia={(media) => {
                              setDraft({
                                ...draft,
                                apps: {
                                  ...draft.apps,
                                  buttons: updateAt(draft.apps.buttons, index, { ...row, mediaId: media.id }),
                                },
                              });
                              setPickedMediaUrls((prev) => ({ ...prev, [`app:${index}`]: media.fullUrl ?? media.url }));
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </Card>
              </div>
            )}

            {/* TAB 4: PAYMENT & COPYRIGHT */}
            {activeTab === "payment" && (
              <>
                <Card className="flex flex-col gap-5 p-5">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <Icon name="payments" className="text-brand-500" size={22} />
                    <div>
                      <h3 className="text-base font-bold text-text">Payment Gateway Strip</h3>
                      <p className="text-xs text-muted">Configure the payment accepted label and logos banner</p>
                    </div>
                  </div>

                  <TranslatedField
                    label="Pay With Label"
                    value={draft.payment.label}
                    langMode={langMode}
                    placeholder={{ en: "Pay With:", bn: "পেমেন্ট মাধ্যম:" }}
                    onChange={(next) => setDraft({ ...draft, payment: { ...draft.payment, label: next } })}
                  />

                  <div className="flex flex-col gap-2">
                    <span className="text-xs font-semibold text-text">Payment Logos Banner Image</span>
                    <MediaPicker
                      label="Select Payment Banner"
                      value={pickedMediaUrls.payment}
                      onChange={() => {}}
                      onSelectMedia={(media) => {
                        setDraft({ ...draft, payment: { ...draft.payment, mediaId: media.id } });
                        setPickedMediaUrls((prev) => ({ ...prev, payment: media.fullUrl ?? media.url }));
                      }}
                    />
                  </div>
                </Card>

                <Card className="flex flex-col gap-5 p-5">
                  <div className="flex items-center gap-2 border-b border-border pb-3">
                    <Icon name="copyright" className="text-brand-500" size={22} />
                    <div>
                      <h3 className="text-base font-bold text-text">Copyright String</h3>
                      <p className="text-xs text-muted">Legal copyright text displayed at the bottom</p>
                    </div>
                  </div>

                  <TranslatedField
                    label="Copyright Text Template"
                    value={draft.copyright}
                    langMode={langMode}
                    placeholder={{
                      en: "© {year} Amader Store. All rights reserved.",
                      bn: "© {year} আমাদের স্টোর। সর্বস্বত্ব সংরক্ষিত।",
                    }}
                    onChange={(next) => setDraft({ ...draft, copyright: next })}
                  />

                  <div className="flex items-center gap-2 rounded-md bg-brand-500/10 p-3 text-xs text-brand-600 dark:text-brand-400">
                    <Icon name="info" size={18} />
                    <span>
                      Use <strong>{"{year}"}</strong> in the text — it is automatically replaced with the current year (
                      {new Date().getFullYear()}).
                    </span>
                  </div>
                </Card>
              </>
            )}
          </div>
        )}

        {/* Live Preview Panel Column (Split mode or Full Preview mode) */}
        {(viewMode === "split" || viewMode === "preview" || activeTab === "preview") && (
          <div
            className={`flex flex-col gap-4 ${
              viewMode === "split" ? "sticky top-4 self-start" : "w-full"
            }`}
          >
            {/* Live Preview Header Toolbar */}
            <div className="flex flex-wrap items-center justify-between rounded-lg border border-border bg-surface p-3 shadow-xs">
              <div className="flex items-center gap-2">
                <Icon name="visibility" className="text-brand-500" size={20} />
                <span className="text-sm font-bold text-text">Live Preview</span>
                <span className="rounded-full bg-brand-500/10 px-2 py-0.5 text-[11px] font-semibold text-brand-500">
                  Real-time
                </span>
              </div>

              <div className="flex items-center gap-3">
                {/* Language Switcher for Preview */}
                <div className="flex items-center gap-1 text-xs">
                  <span className="text-muted font-medium">Lang:</span>
                  <button
                    type="button"
                    onClick={() => setPreviewLang("en")}
                    className={`rounded px-2 py-0.5 font-semibold transition-colors ${
                      previewLang === "en" ? "bg-indigo-600 text-white" : "text-muted hover:text-text"
                    }`}
                  >
                    EN
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewLang("bn")}
                    className={`rounded px-2 py-0.5 font-semibold transition-colors ${
                      previewLang === "bn" ? "bg-emerald-600 text-white" : "text-muted hover:text-text"
                    }`}
                  >
                    BN
                  </button>
                </div>

                {/* Device Viewport Selector */}
                <div className="flex items-center rounded border border-border bg-surface-2 p-0.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("desktop")}
                    className={`flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors ${
                      previewDevice === "desktop" ? "bg-brand-500 text-white" : "text-muted hover:text-text"
                    }`}
                  >
                    <Icon name="desktop_windows" size={16} /> Desktop
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewDevice("mobile")}
                    className={`flex items-center gap-1 rounded px-2 py-1 font-medium transition-colors ${
                      previewDevice === "mobile" ? "bg-brand-500 text-white" : "text-muted hover:text-text"
                    }`}
                  >
                    <Icon name="smartphone" size={16} /> Mobile
                  </button>
                </div>
              </div>
            </div>

            {/* Viewport Frame */}
            <div className="rounded-xl border border-border bg-surface-2 p-4 shadow-inner overflow-hidden">
              <div
                className={`transition-all duration-300 mx-auto ${
                  previewDevice === "mobile"
                    ? "w-fit rounded-[32px] border-8 border-gray-800 shadow-2xl overflow-hidden bg-white"
                    : "w-full rounded-lg border border-border bg-white overflow-hidden"
                }`}
              >
                {/* Device Notch Header in Mobile mode */}
                {previewDevice === "mobile" && (
                  <div className="bg-gray-800 py-1.5 px-4 flex items-center justify-between text-[10px] text-gray-400">
                    <span>9:41</span>
                    <div className="h-3 w-16 rounded-full bg-gray-900" />
                    <span>100%</span>
                  </div>
                )}

                {/* Rendered in an iframe, not a plain div: the footer's
                    md:/lg: breakpoints resolve against the viewport, so a
                    width-constrained div would still show the desktop layout
                    squeezed narrow. The iframe gives it a real 390px viewport
                    and the true mobile layout. */}
                <PreviewFrame
                  key={previewDevice}
                  width={previewDevice === "mobile" ? 390 : "100%"}
                  className="bg-white"
                >
                  <PublicFooter {...publicProps} />
                </PreviewFrame>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
