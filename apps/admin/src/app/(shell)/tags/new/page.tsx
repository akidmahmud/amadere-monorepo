"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";
import { StatusSelect } from "@/components/StatusSelect";
import { useCreateTag } from "@/hooks/useTags";
import type { PublishStatus } from "@/hooks/useBrands";

const headerStyle = { background: "linear-gradient(135deg, #1E1B4B 0%, #4338CA 100%)" };

function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, "")
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function NewTagPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [descBn, setDescBn] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descEn, setDescEn] = useState("");
  const [status, setStatus] = useState<PublishStatus>("PUBLISHED");
  const [activeLangTab, setActiveLangTab] = useState<"BN" | "EN">("BN");
  const create = useCreateTag();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      slug,
      status,
      translations: [
        { locale: "BN", name: nameBn || nameEn, description: descBn || undefined },
        { locale: "EN", name: nameEn || nameBn, description: descEn || undefined },
      ],
    });
    router.push("/tags");
  }

  function handleAutoSlug() {
    const source = nameEn || nameBn;
    if (source) setSlug(slugify(source));
  }

  const activeName = activeLangTab === "BN" ? nameBn : nameEn;

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col gap-4">
        <Link
          href="/tags"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text transition-colors self-start"
        >
          <Icon name="arrow_back" size={16} />
          <span>Back to Tags</span>
        </Link>

        <PageHeader
          icon={<Icon name="add_circle" />}
          title="Create New Tag"
          subtitle="Add a new product label for storefront filtering, badges, and search indexing."
          style={headerStyle}
        />
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Language Tabs & Name Inputs */}
          <Card className="flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-inner bg-brand-50 text-brand-500">
                  <Icon name="title" size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text">Tag Name & Details</h3>
                  <p className="text-xs text-muted">Bilingual names and descriptions</p>
                </div>
              </div>

              {/* Language Switcher */}
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
                    ট্যাগ নাম (Bangla Tag Name) <span className="text-danger">*</span>
                  </span>
                  <input
                    required
                    value={nameBn}
                    onChange={(e) => {
                      setNameBn(e.target.value);
                      if (!slug) setSlug(slugify(e.target.value));
                    }}
                    placeholder="যেমন: অরগানিক"
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">বিবরণ (Bangla Description)</span>
                  <textarea
                    value={descBn}
                    onChange={(e) => setDescBn(e.target.value)}
                    rows={3}
                    placeholder="ট্যাগের সংক্ষিপ্ত বিবরণ..."
                    className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500 transition-colors"
                  />
                </label>
              </div>
            ) : (
              <div className="flex flex-col gap-4">
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">
                    Tag Name (English) <span className="text-danger">*</span>
                  </span>
                  <input
                    required
                    value={nameEn}
                    onChange={(e) => {
                      setNameEn(e.target.value);
                      if (!slug) setSlug(slugify(e.target.value));
                    }}
                    placeholder="e.g. Organic"
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 transition-colors"
                  />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-xs font-semibold text-secondary">Description (English)</span>
                  <textarea
                    value={descEn}
                    onChange={(e) => setDescEn(e.target.value)}
                    rows={3}
                    placeholder="Brief description for SEO..."
                    className="rounded-sm border border-border bg-surface p-3 text-sm text-text outline-none focus:border-brand-500 transition-colors"
                  />
                </label>
              </div>
            )}
          </Card>

          {/* Slug & URL Card */}
          <Card className="flex flex-col gap-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-2.5">
                <div className="grid h-9 w-9 place-items-center rounded-inner bg-brand-50 text-brand-500">
                  <Icon name="link" size={18} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text">URL Slug Structure</h3>
                  <p className="text-xs text-muted">Used in storefront filtering links</p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleAutoSlug}
                className="inline-flex items-center gap-1 text-xs font-bold text-brand-500 hover:underline"
              >
                <Icon name="auto_fix_high" size={14} /> Auto-Generate
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">
                  Slug <span className="text-danger">*</span>
                </span>
                <input
                  required
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="e.g. organic"
                  className="h-10 rounded-sm border border-border bg-surface px-3 font-mono text-sm text-text outline-none focus:border-brand-500"
                />
              </label>

              {/* URL Preview */}
              <div className="rounded-inner bg-surface-2 p-3 border border-border text-xs flex items-center justify-between">
                <span className="font-semibold text-muted">Storefront URL:</span>
                <span className="font-mono font-bold text-brand-500 truncate ml-2">
                  https://amadere.com/tags/{slug || "your-slug"}
                </span>
              </div>
            </div>
          </Card>

          {/* Sticky Actions */}
          <div className="flex items-center justify-end gap-3 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <Link href="/tags">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
            <Button type="submit" variant="primary" disabled={create.isPending} className="min-w-[130px]">
              {create.isPending ? "Creating…" : "Create Tag"}
            </Button>
          </div>
        </div>

        {/* Right Sidebar (1 Col) */}
        <div className="flex flex-col gap-6">
          {/* Status Select Card */}
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Icon name="toggle_on" size={18} className="text-brand-500" />
              <h3 className="text-sm font-bold text-text">Visibility Status</h3>
            </div>

            <StatusSelect value={status} onChange={setStatus} />
          </Card>

          {/* Badge Preview */}
          <Card className="flex flex-col gap-4 border-l-4 border-l-brand-500 bg-brand-50/20">
            <div className="flex items-center gap-2">
              <Icon name="visibility" size={18} className="text-brand-500" />
              <h4 className="text-xs font-bold text-brand-600 uppercase tracking-wider">Badge Preview</h4>
            </div>

            <p className="text-xs text-muted">Live view on product cards:</p>

            <div className="flex items-center justify-center p-4 rounded-inner bg-surface border border-border shadow-2xs">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-50 px-3.5 py-1.5 text-xs font-extrabold text-brand-600 border border-brand-200 shadow-2xs">
                🏷️ {activeName || slug || "Tag Preview"}
              </span>
            </div>
          </Card>
        </div>
      </form>
    </div>
  );
}
