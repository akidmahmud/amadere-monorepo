"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Icon, PageHeader, ToggleSwitch } from "@amader/admin-ui";
import { SectionConfigFields } from "@/components/homepage-sections/SectionConfigFields";
import { useDeleteHomepageSection, useHomepageSection, useUpdateHomepageSection } from "@/hooks/useHomepageSections";
import { sanitizeHomepageSectionConfig } from "@/lib/sanitize-section-config";

const headerStyle = { background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" };

const TYPE_DESCRIPTIONS: Record<string, string> = {
  HERO_BANNER: "Desktop hero slider with optional side banner (1882 × 500px).",
  HOME_BANNER_TWO: "Full-bleed promo slider with desktop (1690 × 575px) & mobile crops.",
  BANNER_STRIP: "Wide full-width promotional banner strip (1690 × 195px).",
  AD_BANNER: "Auto-advancing promotion slider banner (1686 × 759px).",
  PRODUCT_COLLECTION: "Grid or carousel showing products from a selected collection.",
  CATEGORY_SHOWCASE: "Interactive category showcase with custom category badges.",
  TOP_SELLING_PRODUCTS: "Best-selling products grid with optional badges.",
  BLOG_TEASER: "Teaser cards for published blog posts.",
  TESTIMONIAL_BENTO: "Customer testimonial quotes with ratings & avatars.",
  CERTIFICATION_ROW: "Row of trust badges, awards, and certifications.",
};

export default function EditHomepageSectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const sectionId = Number(id);
  const router = useRouter();
  const { data: section, isLoading } = useHomepageSection(sectionId);
  const update = useUpdateHomepageSection(sectionId);
  const deleteSection = useDeleteHomepageSection();

  const [headingBn, setHeadingBn] = useState("");
  const [subheadingBn, setSubheadingBn] = useState("");
  const [headingEn, setHeadingEn] = useState("");
  const [subheadingEn, setSubheadingEn] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [activeLangTab, setActiveLangTab] = useState<"BN" | "EN">("BN");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [collectionId, setCollectionId] = useState<number | undefined>();

  useEffect(() => {
    if (!section) return;
    const bnTrans = section.translations.find((t) => (t as unknown as { locale?: string }).locale === "BN") ?? section.translations[0];
    const enTrans = section.translations.find((t) => (t as unknown as { locale?: string }).locale === "EN") ?? section.translations[0];

    setHeadingBn(bnTrans?.heading ?? "");
    setSubheadingBn(bnTrans?.subheading ?? "");
    setHeadingEn(enTrans?.heading ?? "");
    setSubheadingEn(enTrans?.subheading ?? "");
    setIsActive(section.isActive);
    setConfig(section.config ?? {});
    setCollectionId(section.collectionId ?? undefined);
  }, [section]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!section) return;

    await update.mutateAsync({
      isActive,
      config: sanitizeHomepageSectionConfig(section.type, config),
      collectionId,
      translations: [
        { locale: "BN", heading: headingBn || undefined, subheading: subheadingBn || undefined },
        { locale: "EN", heading: headingEn || undefined, subheading: subheadingEn || undefined },
      ],
    });
    router.push("/homepage-sections");
  }

  async function handleDelete() {
    if (!confirm("Are you sure you want to delete this section? This action cannot be undone.")) return;
    await deleteSection.mutateAsync(sectionId);
    router.push("/homepage-sections");
  }

  if (isLoading || !section) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Icon name="progress_activity" className="animate-spin" size={20} />
          <span>Loading homepage section #{sectionId}…</span>
        </div>
      </div>
    );
  }

  const formattedType = section.type.replaceAll("_", " ");
  const description = TYPE_DESCRIPTIONS[section.type] ?? "Custom homepage layout section.";

  return (
    <div className="flex flex-col gap-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link
            href="/homepage-sections"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text transition-colors"
          >
            <Icon name="arrow_back" size={16} />
            <span>Back to Homepage Sections</span>
          </Link>
          <div className="flex items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
                isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-200" : "bg-slate-100 text-slate-600 border border-slate-200"
              }`}
            >
              <span className={`h-2 w-2 rounded-full ${isActive ? "bg-emerald-500" : "bg-slate-400"}`} />
              {isActive ? "ACTIVE SECTION" : "DISABLED"}
            </span>
          </div>
        </div>

        <PageHeader
          icon={<Icon name="view_quilt" />}
          title={`Section #${section.id}: ${headingBn || headingEn || formattedType}`}
          subtitle={`${formattedType} — ${description}`}
          style={headerStyle}
        />
      </div>

      {/* Main Form Form Grid */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form & Configuration (2 Cols) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Section Titles Card */}
          <Card className="flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-inner bg-brand-50 text-brand-500">
                  <Icon name="title" size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text">Section Headings</h3>
                  <p className="text-xs text-muted">Configure title and subtitle text for customers</p>
                </div>
              </div>

              {/* Language Switcher Tabs */}
              <div className="flex rounded-sm bg-surface-2 p-1 border border-border">
                <button
                  type="button"
                  onClick={() => setActiveLangTab("BN")}
                  className={`rounded-xs px-3 py-1 text-xs font-bold transition-all ${
                    activeLangTab === "BN" ? "bg-surface text-brand-500 shadow-2xs" : "text-muted hover:text-text"
                  }`}
                >
                  বাংলা (BN)
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLangTab("EN")}
                  className={`rounded-xs px-3 py-1 text-xs font-bold transition-all ${
                    activeLangTab === "EN" ? "bg-surface text-brand-500 shadow-2xs" : "text-muted hover:text-text"
                  }`}
                >
                  English (EN)
                </button>
              </div>
            </div>

            {activeLangTab === "BN" ? (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">
                    শিরোনাম (Heading in Bangla)
                  </span>
                  <input
                    value={headingBn}
                    onChange={(e) => setHeadingBn(e.target.value)}
                    placeholder="যেমন: আমাদের জনপ্রিয় প্রোডাক্টস"
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">
                    উপ-শিরোনাম (Subheading in Bangla)
                  </span>
                  <input
                    value={subheadingBn}
                    onChange={(e) => setSubheadingBn(e.target.value)}
                    placeholder="যেমন: একসাথে কিনলে সর্বোচ্চ ছাড়"
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 transition-colors"
                  />
                </label>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">
                    Heading (English)
                  </span>
                  <input
                    value={headingEn}
                    onChange={(e) => setHeadingEn(e.target.value)}
                    placeholder="e.g. Popular Products"
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">
                    Subheading (English)
                  </span>
                  <input
                    value={subheadingEn}
                    onChange={(e) => setSubheadingEn(e.target.value)}
                    placeholder="e.g. Best offers on combined items"
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 transition-colors"
                  />
                </label>
              </div>
            )}
          </Card>

          {/* Section Configuration Editor Card */}
          <Card className="flex flex-col gap-5">
            <div className="flex items-center gap-2.5 border-b border-border pb-4">
              <div className="grid h-9 w-9 place-items-center rounded-inner bg-brand-50 text-brand-500">
                <Icon name="tune" size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">Section Content & Settings</h3>
                <p className="text-xs text-muted">Customize images, slides, products, and curation</p>
              </div>
            </div>

            <SectionConfigFields
              type={section.type}
              config={config}
              onConfigChange={setConfig}
              collectionId={collectionId}
              onCollectionIdChange={setCollectionId}
            />
          </Card>

          {/* Sticky Actions Bar */}
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={deleteSection.isPending}
              className="text-danger hover:bg-danger/5"
            >
              <Icon name="delete" size={16} />
              <span>{deleteSection.isPending ? "Deleting…" : "Delete section"}</span>
            </Button>

            <div className="flex items-center gap-3">
              <Link href="/homepage-sections">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" variant="primary" disabled={update.isPending} className="min-w-[140px]">
                {update.isPending ? "Saving changes…" : "Save changes"}
              </Button>
            </div>
          </div>
          {update.isError && (
            <p className="text-xs text-danger font-semibold">
              {update.error instanceof Error ? update.error.message : "Failed to save section changes."}
            </p>
          )}
        </div>

        {/* Right Column: Sidebar Meta & Guidelines (1 Col) */}
        <div className="flex flex-col gap-6">
          {/* Status & Control Panel */}
          <Card className="flex flex-col gap-5">
            <div className="flex items-center gap-2.5 border-b border-border pb-3">
              <Icon name="settings" size={18} className="text-brand-500" />
              <h3 className="text-sm font-bold text-text">Controls & Status</h3>
            </div>

            <div className="flex flex-col gap-4">
              <ToggleSwitch
                checked={isActive}
                onChange={setIsActive}
                label="Enable on Storefront"
              />

              <div className="flex items-center justify-between rounded-inner bg-surface-2 p-3 text-xs">
                <span className="font-semibold text-secondary">Section ID</span>
                <span className="font-mono font-bold text-brand-500">#{section.id}</span>
              </div>

              <div className="flex items-center justify-between rounded-inner bg-surface-2 p-3 text-xs">
                <span className="font-semibold text-secondary">Section Type</span>
                <span className="rounded-sm bg-brand-50 px-2 py-0.5 font-mono text-[11px] font-bold text-brand-500">
                  {section.type}
                </span>
              </div>

              <div className="flex items-center justify-between rounded-inner bg-surface-2 p-3 text-xs">
                <span className="font-semibold text-secondary">Display Position</span>
                <span className="font-bold text-text">Order #{section.sortOrder}</span>
              </div>
            </div>
          </Card>

          {/* Type Guidelines & Recommendations */}
          <Card className="flex flex-col gap-4 border-l-4 border-l-brand-500 bg-brand-50/20">
            <div className="flex items-center gap-2">
              <Icon name="info" size={18} className="text-brand-500" />
              <h4 className="text-xs font-bold text-brand-600 uppercase tracking-wider">Guidelines</h4>
            </div>
            <p className="text-xs text-text leading-relaxed font-medium">
              {description}
            </p>
            <div className="rounded-inner bg-surface p-3 border border-border text-[11px] text-muted space-y-1">
              <p className="font-bold text-secondary">✨ Pro Tip:</p>
              <p>Ensure high-resolution images are used for crisp presentation across desktop and mobile screens.</p>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
