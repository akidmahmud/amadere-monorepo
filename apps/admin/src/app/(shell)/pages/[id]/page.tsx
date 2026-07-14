"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
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

  if (isLoading || !page) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Title</span>
          <input required value={title} onChange={(e) => setTitle(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Slug</span>
          <input required value={slug} onChange={(e) => setSlug(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Content (HTML)</span>
          <textarea required value={content} onChange={(e) => setContent(e.target.value)} rows={10} className="rounded-sm border border-border bg-surface p-3 font-mono text-xs text-text outline-none focus:border-brand-500" />
        </label>
        <StatusSelect value={status} onChange={setStatus} />

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Link href="/pages">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
