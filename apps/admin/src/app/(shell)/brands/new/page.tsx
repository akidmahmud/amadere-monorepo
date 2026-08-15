"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import { RichTextEditor } from "@/components/RichTextEditor";
import { StatusSelect } from "@/components/StatusSelect";
import { useCreateBrand } from "@/hooks/useBrands";
import type { PublishStatus } from "@/hooks/useBrands";

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

export default function NewBrandPage() {
  const router = useRouter();
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoUrl, setLogoUrl] = useState<string | undefined>();
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [isFeatured, setIsFeatured] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const wordCount = countWords(description);
  const create = useCreateBrand();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (wordCount > DESCRIPTION_MAX_WORDS) {
      setFormError(`Description can't be more than ${DESCRIPTION_MAX_WORDS} words.`);
      return;
    }
    setFormError(null);
    await create.mutateAsync({
      slug,
      logoUrl,
      websiteUrl: websiteUrl || undefined,
      isFeatured,
      sortOrder: 0,
      status,
      translations: [
        { locale: "EN", name, description: description || undefined },
        { locale: "BN", name, description: description || undefined },
      ],
    });
    router.push("/brands");
  }

  return (
    <Card className="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Slug</span>
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <div className="flex flex-col gap-1.5">
          <span className="flex items-center justify-between text-xs font-semibold text-secondary">
            Description (optional)
            <span className={wordCount > DESCRIPTION_MAX_WORDS ? "font-semibold text-danger" : "font-semibold text-muted"}>
              {wordCount}/{DESCRIPTION_MAX_WORDS} words
            </span>
          </span>
          <RichTextEditor value={description} onChange={setDescription} compact />
        </div>
        {formError && (
          <div className="flex items-center gap-2.5 rounded-inner border border-danger/30 bg-danger/10 px-3.5 py-2.5 text-[0.75rem] font-semibold text-danger">
            {formError}
          </div>
        )}
        <MediaPicker value={logoUrl} onChange={setLogoUrl} label="Logo" />
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Website URL (optional)</span>
          <input
            value={websiteUrl}
            onChange={(e) => setWebsiteUrl(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <StatusSelect value={status} onChange={setStatus} />
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
          Featured
        </label>

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create brand"}
          </Button>
          <Link href="/brands">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
