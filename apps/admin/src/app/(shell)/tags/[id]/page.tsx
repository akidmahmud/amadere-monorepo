"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";
import { RichTextEditor } from "@/components/RichTextEditor";
import { StatusSelect } from "@/components/StatusSelect";
import { useDeleteTag, useTag, useUpdateTag } from "@/hooks/useTags";
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

// Same stripper/counter as ProductFormFields.tsx/CategoryFormFields.tsx —
// duplicated per-form, matching this codebase's existing convention.
function stripHtml(str: string): string {
  if (!str) return "";
  return str
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z0-9#]+;/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function countWords(str: string): number {
  const plain = stripHtml(str);
  return plain ? plain.split(/\s+/).filter(Boolean).length : 0;
}

const DESCRIPTION_MAX_WORDS = 450;

export default function EditTagPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const tagId = Number(id);
  const router = useRouter();
  const { data: tag, isLoading } = useTag(tagId);
  const update = useUpdateTag(tagId);
  const deleteTag = useDeleteTag();

  const [slug, setSlug] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [descBn, setDescBn] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [descEn, setDescEn] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [activeLangTab, setActiveLangTab] = useState<"BN" | "EN">("BN");
  const [formError, setFormError] = useState<string | null>(null);
  const bnWordCount = countWords(descBn);
  const enWordCount = countWords(descEn);

  useEffect(() => {
    if (!tag) return;
    const bnTrans = tag.translations.find((t) => (t as unknown as { locale?: string }).locale === "BN") ?? tag.translations[0];
    const enTrans = tag.translations.find((t) => (t as unknown as { locale?: string }).locale === "EN") ?? tag.translations[0];

    setSlug(tag.slug);
    setNameBn(bnTrans?.name ?? "");
    setDescBn(bnTrans?.description ?? "");
    setNameEn(enTrans?.name ?? "");
    setDescEn(enTrans?.description ?? "");
    setStatus(tag.status);
  }, [tag]);

  async function handleSubmit(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (bnWordCount > DESCRIPTION_MAX_WORDS || enWordCount > DESCRIPTION_MAX_WORDS) {
      setFormError(`Description can't be more than ${DESCRIPTION_MAX_WORDS} words.`);
      return;
    }
    setFormError(null);
    await update.mutateAsync({
      slug,
      status,
      translations: [
        { locale: "BN", name: nameBn || nameEn, description: descBn || undefined },
        { locale: "EN", name: nameEn || nameBn, description: descEn || undefined },
      ],
    });
    router.push("/tags");
  }

  async function handleDelete() {
    if (!confirm(`Are you sure you want to delete tag "${nameBn || nameEn || slug}"?`)) return;
    await deleteTag.mutateAsync(tagId);
    router.push("/tags");
  }

  function handleAutoSlug() {
    const source = nameEn || nameBn;
    if (source) setSlug(slugify(source));
  }

  if (isLoading || !tag) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="flex items-center gap-3 text-sm text-muted">
          <Icon name="progress_activity" className="animate-spin" size={20} />
          <span>Loading tag #{tagId}…</span>
        </div>
      </div>
    );
  }

  const activeName = activeLangTab === "BN" ? nameBn : nameEn;

  return (
    <div className="flex flex-col gap-6">
      {/* Header & Breadcrumbs */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <Link
            href="/tags"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted hover:text-text transition-colors"
          >
            <Icon name="arrow_back" size={16} />
            <span>Back to Tags</span>
          </Link>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold border ${
              status === "PUBLISHED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : status === "DRAFT"
                ? "bg-amber-50 text-amber-700 border-amber-200"
                : "bg-slate-100 text-slate-600 border-slate-200"
            }`}
          >
            <span
              className={`h-2 w-2 rounded-full ${
                status === "PUBLISHED" ? "bg-emerald-500" : status === "DRAFT" ? "bg-amber-500" : "bg-slate-400"
              }`}
            />
            {status}
          </span>
        </div>

        <PageHeader
          icon={<Icon name="local_offer" />}
          title={`Edit Tag: ${nameBn || nameEn || tag.slug}`}
          subtitle={`Tag ID: #${tag.id} · Identifier slug: /tags/${tag.slug}`}
          style={headerStyle}
        />
      </div>

      {/* Main Form */}
      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 Cols) */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Language Tabs & Inputs */}
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
                    onChange={(e) => setNameBn(e.target.value)}
                    placeholder="যেমন: অরগানিক বা প্রাকৃতিক"
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 transition-colors"
                  />
                </label>
                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center justify-between text-xs font-semibold text-secondary">
                    বিবরণ (Bangla Description)
                    <span className={bnWordCount > DESCRIPTION_MAX_WORDS ? "font-semibold text-danger" : "font-semibold text-muted"}>
                      {bnWordCount}/{DESCRIPTION_MAX_WORDS} words
                    </span>
                  </span>
                  <RichTextEditor value={descBn} onChange={setDescBn} compact />
                </div>
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
                    onChange={(e) => setNameEn(e.target.value)}
                    placeholder="e.g. Organic Food"
                    className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500 transition-colors"
                  />
                </label>
                <div className="flex flex-col gap-1.5">
                  <span className="flex items-center justify-between text-xs font-semibold text-secondary">
                    Description (English)
                    <span className={enWordCount > DESCRIPTION_MAX_WORDS ? "font-semibold text-danger" : "font-semibold text-muted"}>
                      {enWordCount}/{DESCRIPTION_MAX_WORDS} words
                    </span>
                  </span>
                  <RichTextEditor value={descEn} onChange={setDescEn} compact />
                </div>
              </div>
            )}
          </Card>

          {formError && (
            <div className="flex items-center gap-2.5 rounded-inner border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[0.75rem] font-semibold text-danger">
              {formError}
            </div>
          )}

          {/* Slug & URL Structure Card */}
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
                  placeholder="e.g. organic-food"
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
          <div className="flex items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-sm">
            <Button
              type="button"
              variant="ghost"
              onClick={handleDelete}
              disabled={deleteTag.isPending}
              className="text-danger hover:bg-danger/5"
            >
              <Icon name="delete" size={16} />
              <span>{deleteTag.isPending ? "Deleting…" : "Delete Tag"}</span>
            </Button>

            <div className="flex items-center gap-3">
              <Link href="/tags">
                <Button type="button" variant="ghost">
                  Cancel
                </Button>
              </Link>
              <Button type="submit" variant="primary" disabled={update.isPending} className="min-w-[130px]">
                {update.isPending ? "Saving…" : "Save Changes"}
              </Button>
            </div>
          </div>
        </div>

        {/* Right Sidebar (1 Col) */}
        <div className="flex flex-col gap-6">
          {/* Status Selection Card */}
          <Card className="flex flex-col gap-4">
            <div className="flex items-center gap-2 border-b border-border pb-3">
              <Icon name="toggle_on" size={18} className="text-brand-500" />
              <h3 className="text-sm font-bold text-text">Visibility Status</h3>
            </div>

            <StatusSelect value={status} onChange={setStatus} />
          </Card>

          {/* Live Storefront Badge Preview Card */}
          <Card className="flex flex-col gap-4 border-l-4 border-l-brand-500 bg-brand-50/20">
            <div className="flex items-center gap-2">
              <Icon name="visibility" size={18} className="text-brand-500" />
              <h4 className="text-xs font-bold text-brand-600 uppercase tracking-wider">Badge Preview</h4>
            </div>

            <p className="text-xs text-muted">This is how the tag badge will appear on product cards:</p>

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
