"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { RichTextEditor } from "@/components/RichTextEditor";
import { StatusSelect } from "@/components/StatusSelect";
import { usePage, useUpdatePage } from "@/hooks/usePages";
import type { PublishStatus } from "@/hooks/useBrands";

export default function EditPagePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const pageId = Number(id);
  const router = useRouter();
  const { data: page, isLoading } = usePage(pageId);
  const update = useUpdatePage(pageId);

  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");

  useEffect(() => {
    if (!page) return;
    setSlug(page.slug);
    setTitle(page.translations[0]?.title ?? "");
    setContent(page.translations[0]?.content ?? "");
    setStatus(page.status);
  }, [page]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      slug,
      status,
      translations: [
        { locale: "EN", title, content },
        { locale: "BN", title, content },
      ],
    });
    router.push("/pages");
  }

  if (isLoading || !page) {
    return (
      <Card className="p-8 text-center text-sm text-secondary">
        <div className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent mb-2" />
        <p>Loading page details…</p>
      </Card>
    );
  }

  const pageTitle = page.translations[0]?.title || page.slug;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Header Navigation */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
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
              <span className="text-text">Edit Page</span>
            </div>
            <h1 className="text-xl font-bold tracking-tight text-text">Edit Page: {pageTitle}</h1>
          </div>
        </div>

        <Link href={`/pages/${pageId}/builder`}>
          <Button variant="primary" className="shadow-sm">
            <svg viewBox="0 0 20 20" fill="currentColor" className="mr-1.5 h-4 w-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.25 5.5a.75.75 0 00-.75.75v8.5c0 .414.336.75.75.75h8.5a.75.75 0 00.75-.75v-4a.75.75 0 011.5 0v4A2.25 2.25 0 0112.75 17h-8.5A2.25 2.25 0 014.25 4h4a.75.75 0 010 1.5h-4z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.25 2.5a.75.75 0 000 1.5h2.44l-6.47 6.47a.75.75 0 101.06 1.06L16.75 5.06v2.44a.75.75 0 001.5 0v-4a.75.75 0 00-.75-.75h-4z" />
            </svg>
            Open Visual Builder
          </Button>
        </Link>
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
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-surface px-3.5 text-sm text-text outline-none transition-colors focus:border-brand-500"
            />
          </div>

          {/* Slug */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-secondary">
              URL Slug <span className="text-red-500">*</span>
            </label>
            <div className="flex items-center rounded-md border border-border bg-surface overflow-hidden focus-within:border-brand-500">
              <span className="bg-surface-hover px-3 py-2 text-xs font-medium text-secondary border-r border-border">
                /pages/
              </span>
              <input
                required
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                className="h-10 flex-1 bg-transparent px-3 text-sm text-text outline-none"
              />
            </div>
          </div>

          {/* Status Select */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold uppercase tracking-wider text-secondary">
              Publication Status
            </label>
            <StatusSelect value={status} onChange={setStatus} />
          </div>

          {/* Classic HTML Editor Area */}
          <div className="space-y-1.5 border-t border-border pt-5">
            <label className="text-xs font-bold uppercase tracking-wider text-secondary">
              Classic Content (HTML Editor)
            </label>
            <RichTextEditor value={content} onChange={setContent} />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 border-t border-border pt-5">
            <Button type="submit" variant="primary" disabled={update.isPending} className="shadow-sm">
              {update.isPending ? "Saving Changes…" : "Save Changes"}
            </Button>
            <Link href="/pages">
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
