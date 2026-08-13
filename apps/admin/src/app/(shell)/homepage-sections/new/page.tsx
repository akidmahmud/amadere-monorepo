"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";
import { SectionConfigFields } from "@/components/homepage-sections/SectionConfigFields";
import { HOMEPAGE_SECTION_TYPES, useCreateHomepageSection, type HomepageSectionType } from "@/hooks/useHomepageSections";
import { sanitizeHomepageSectionConfig } from "@/lib/sanitize-section-config";

const headerStyle = { background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" };

export default function NewHomepageSectionPage() {
  const router = useRouter();
  const [type, setType] = useState<HomepageSectionType>("HERO_BANNER");
  const [headingBn, setHeadingBn] = useState("");
  const [subheadingBn, setSubheadingBn] = useState("");
  const [headingEn, setHeadingEn] = useState("");
  const [subheadingEn, setSubheadingEn] = useState("");
  const [activeLangTab, setActiveLangTab] = useState<"BN" | "EN">("BN");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [collectionId, setCollectionId] = useState<number | undefined>();
  const create = useCreateHomepageSection();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      type,
      isActive: true,
      sortOrder: 0,
      config: sanitizeHomepageSectionConfig(type, config),
      collectionId,
      translations:
        headingBn || subheadingBn || headingEn || subheadingEn
          ? [
              { locale: "BN", heading: headingBn || undefined, subheading: subheadingBn || undefined },
              { locale: "EN", heading: headingEn || undefined, subheading: subheadingEn || undefined },
            ]
          : undefined,
    });
    router.push("/homepage-sections");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Top Breadcrumb & Header */}
      <div className="flex flex-col gap-4">
        <Link
          href="/homepage-sections"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text transition-colors self-start"
        >
          <Icon name="arrow_back" size={16} />
          <span>Back to Homepage Sections</span>
        </Link>

        <PageHeader
          icon={<Icon name="add_circle" />}
          title="Create Homepage Section"
          subtitle="Add a new interactive section to display on your storefront homepage."
          style={headerStyle}
        />
      </div>

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Config Form (2 Cols) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Section Type Selector Card */}
          <Card className="flex flex-col gap-5">
            <div className="flex items-center gap-2.5 border-b border-border pb-4">
              <div className="grid h-9 w-9 place-items-center rounded-inner bg-brand-50 text-brand-500">
                <Icon name="category" size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">Choose Section Type</h3>
                <p className="text-xs text-muted">Select the layout component to add</p>
              </div>
            </div>

            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Section Type</span>
              <select
                value={type}
                onChange={(e) => {
                  setType(e.target.value as HomepageSectionType);
                  setConfig({});
                  setCollectionId(undefined);
                }}
                className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 font-semibold"
              >
                {HOMEPAGE_SECTION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t.replaceAll("_", " ")}
                  </option>
                ))}
              </select>
            </label>
          </Card>

          {/* Section Headings Card */}
          <Card className="flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-inner bg-brand-50 text-brand-500">
                  <Icon name="title" size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text">Section Headings</h3>
                  <p className="text-xs text-muted">Configure titles for customers</p>
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
                    placeholder="যেমন: সেরা অফারসমূহ"
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
                    placeholder="যেমন: আজকের বিশেষ ডিসকাউন্ট প্রডাক্ট"
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
                    placeholder="e.g. Best Deals"
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
                    placeholder="e.g. Featured discounted products"
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 transition-colors"
                  />
                </label>
              </div>
            )}
          </Card>

          {/* Section Config Card */}
          <Card className="flex flex-col gap-5">
            <div className="flex items-center gap-2.5 border-b border-border pb-4">
              <div className="grid h-9 w-9 place-items-center rounded-inner bg-brand-50 text-brand-500">
                <Icon name="tune" size={18} />
              </div>
              <div>
                <h3 className="text-sm font-bold text-text">Section Content & Settings</h3>
                <p className="text-xs text-muted">Customize items for {type.replaceAll("_", " ")}</p>
              </div>
            </div>

            <SectionConfigFields
              type={type}
              config={config}
              onConfigChange={setConfig}
              collectionId={collectionId}
              onCollectionIdChange={setCollectionId}
            />
          </Card>

          {/* Actions Bar */}
          <div className="flex items-center justify-end gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <Link href="/homepage-sections">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="primary" disabled={create.isPending} className="min-w-[140px]">
              {create.isPending ? "Creating section…" : "Create section"}
            </Button>
          </div>
        </div>

        {/* Right Column Sidebar Guidelines */}
        <div className="flex flex-col gap-6">
          <Card className="flex flex-col gap-4 border-l-4 border-l-brand-500 bg-brand-50/20">
            <div className="flex items-center gap-2">
              <Icon name="info" size={18} className="text-brand-500" />
              <h4 className="text-xs font-bold text-brand-600 uppercase tracking-wider">Help & Guidance</h4>
            </div>
            <p className="text-xs text-text leading-relaxed font-medium">
              New sections will automatically be added to the bottom of the homepage. You can drag to reorder sections anytime from the main list.
            </p>
          </Card>
        </div>
      </form>
    </div>
  );
}
