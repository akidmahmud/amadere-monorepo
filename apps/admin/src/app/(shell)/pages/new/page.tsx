"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { StatusSelect } from "@/components/StatusSelect";
import { useCreatePage } from "@/hooks/usePages";
import type { PublishStatus } from "@/hooks/useBrands";

export default function NewPagePage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const create = useCreatePage();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      slug,
      status,
      translations: [
        { locale: "EN", title, content },
        { locale: "BN", title, content },
      ],
    });
    router.push("/pages");
  }

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
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create page"}
          </Button>
          <Link href="/pages">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
