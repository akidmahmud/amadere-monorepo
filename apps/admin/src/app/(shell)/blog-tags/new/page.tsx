"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { StatusSelect } from "@/components/StatusSelect";
import { useCreateBlogTag } from "@/hooks/useBlogTags";
import type { PublishStatus } from "@/hooks/useBrands";

export default function NewBlogTagPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const create = useCreateBlogTag();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ slug, status, translations: [{ locale: "EN", name }, { locale: "BN", name }] });
    router.push("/blog-tags");
  }

  return (
    <Card className="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Name</span>
          <input required value={name} onChange={(e) => setName(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Slug</span>
          <input required value={slug} onChange={(e) => setSlug(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
        </label>
        <StatusSelect value={status} onChange={setStatus} />

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create tag"}
          </Button>
          <Link href="/blog-tags">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
