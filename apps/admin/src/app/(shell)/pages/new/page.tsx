"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { RichTextEditor } from "@/components/RichTextEditor";
import { StatusSelect } from "@/components/StatusSelect";
import { useCreatePage } from "@/hooks/usePages";
import type { PublishStatus } from "@/hooks/useBrands";

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, "-") // Replace spaces with -
    .replace(/[^\w\-]+/g, "") // Remove all non-word chars
    .replace(/\-\-+/g, "-"); // Replace multiple - with single -
}

export default function NewPagePage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [isSlugCustomized, setIsSlugCustomized] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [useClassicEditor, setUseClassicEditor] = useState(false);
  const create = useCreatePage();

  function handleTitleChange(val: string) {
    setTitle(val);
    if (!isSlugCustomized) {
      setSlug(slugify(val));
    }
  }

  function handleSlugChange(val: string) {
    setSlug(val);
    setIsSlugCustomized(true);
  }

  async function create_(openBuilder: boolean) {
    const page = await create.mutateAsync({
      slug: slug || slugify(title),
      status,
      translations: [
        { locale: "EN", title, content },
        { locale: "BN", title, content },
      ],
    });
    router.push(openBuilder ? `/pages/${page.id}/builder` : "/pages");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create_(!(useClassicEditor && content.trim().length > 0));
  }

  const canSubmit = title.trim() && (slug.trim() || title.trim()) && !create.isPending;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header with Breadcrumbs */}
      <div className="flex items-center gap-3">
        <Link
          href="/pages"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-surface text-secondary transition-colors hover:bg-surface-hover hover:text-text"
        >
          <svg viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M17 10a.75.75 0 01-.75.75H5.612l4.158 3.96a.75.75 0 11-1.04 1.08l-5.5-5.25a.75.75 0 010-1.08l5.5-5.25a.75.75 0 111.04 1.08L5.612 9.25H16.25A.75.75 0 0117 10z"
              clipRule="evenodd"
            />
          </svg>
        </Link>
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold text-secondary">
            <Link href="/pages" className="hover:underline">Pages</Link>
            <span>/</span>
            <span className="text-text">Create Page</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-text">Create New Static Page</h1>
        </div>
      </div>

      <Card className="p-6">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-secondary">
              Page Title <span className="text-red-500">*</span>
            </label>
            <input
              required
              placeholder="e.g. About Our Store"
              value={title}
              onChange={(e) => handleTitleChange(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-surface px-3.5 text-sm text-text outline-none transition-colors focus:border-brand-500"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-secondary">
                URL Slug <span className="text-red-500">*</span>
              </label>
              {isSlugCustomized && (
                <button
                  type="button"
                  onClick={() => {
                    setIsSlugCustomized(false);
                    setSlug(slugify(title));
                  }}
                  className="text-xs text-brand-600 hover:underline"
                >
                  Reset auto-slug
                </button>
              )}
            </div>
            <div className="flex items-center rounded-md border border-border bg-surface overflow-hidden focus-within:border-brand-500">
              <span className="bg-surface-hover px-3 py-2 text-xs font-medium text-secondary border-r border-border">
                /pages/
              </span>
              <input
                required
                value={slug}
                onChange={(e) => handleSlugChange(e.target.value)}
                placeholder="about-us"
                className="h-10 flex-1 bg-transparent px-3 text-sm text-text outline-none"
              />
            </div>
            <p className="text-xs text-secondary">
              Live location: <span className="font-mono text-brand-600">/pages/{slug || "your-slug"}</span>
            </p>
          </div>

          {/* Status Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-secondary">
              Publication Status
            </label>
            <StatusSelect value={status} onChange={setStatus} />
          </div>

          {/* Editor Mode Selection Card */}
          <div className="space-y-3 border-t border-border pt-5">
            <label className="text-xs font-bold uppercase tracking-wider text-secondary">
              Authoring Mode
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div
                onClick={() => setUseClassicEditor(false)}
                className={`cursor-pointer rounded-lg border p-4 transition-all ${
                  !useClassicEditor
                    ? "border-brand-500 bg-brand-50/20 ring-2 ring-brand-500/20"
                    : "border-border bg-surface hover:border-secondary"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-brand-500 text-white font-bold text-xs">
                    P
                  </div>
                  {!useClassicEditor && (
                    <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      Selected
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-sm font-bold text-text">Visual Block Builder</h3>
                <p className="mt-1 text-xs text-secondary">
                  Drag & drop visual blocks, hero sections, product grids, and promo banners.
                </p>
              </div>

              <div
                onClick={() => setUseClassicEditor(true)}
                className={`cursor-pointer rounded-lg border p-4 transition-all ${
                  useClassicEditor
                    ? "border-brand-500 bg-brand-50/20 ring-2 ring-brand-500/20"
                    : "border-border bg-surface hover:border-secondary"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-700 text-white font-bold text-xs">
                    HTML
                  </div>
                  {useClassicEditor && (
                    <span className="rounded-full bg-brand-500 px-2 py-0.5 text-[10px] font-bold text-white">
                      Selected
                    </span>
                  )}
                </div>
                <h3 className="mt-3 text-sm font-bold text-text">Classic HTML Editor</h3>
                <p className="mt-1 text-xs text-secondary">
                  Standard WYSIWYG editor for plain text articles, privacy policies, or basic terms.
                </p>
              </div>
            </div>

            {/* Classic Editor Area if selected */}
            {useClassicEditor && (
              <div className="mt-4 space-y-2 rounded-lg border border-border bg-surface-hover p-4">
                <span className="text-xs font-bold text-text">Classic HTML Content</span>
                <RichTextEditor value={content} onChange={setContent} />
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-3 border-t border-border pt-5">
            <Button type="submit" variant="primary" disabled={!canSubmit} className="shadow-sm">
              {create.isPending
                ? "Creating…"
                : !useClassicEditor
                  ? "Create & Launch Builder"
                  : "Save Page"}
            </Button>
            <Button
              type="button"
              variant="ghost"
              disabled={!canSubmit}
              onClick={() => create_(false)}
            >
              Create Metadata Only
            </Button>
            <Link href="/pages" className="ml-auto">
              <Button type="button" variant="ghost">
                Cancel
              </Button>
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
