"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { useCreateAuthor } from "@/hooks/useAuthors";
import type { PublishStatus } from "@/hooks/useBrands";
import { useToast } from "@/components/ToastProvider";
import { AuthorFormFields, cleanSocialLinks, type AuthorSocialLinkDraft } from "@/components/authors/AuthorFormFields";

const cancelButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 text-xs font-bold text-slate-700 transition-colors duration-150 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-2xs";

export default function NewAuthorPage() {
  const router = useRouter();
  const create = useCreateAuthor();
  const toast = useToast();

  const [slug, setSlug] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [nameBn, setNameBn] = useState("");
  const [bioEn, setBioEn] = useState("");
  const [bioBn, setBioBn] = useState("");
  const [photoUrl, setPhotoUrl] = useState<string | undefined>();
  const [socialLinks, setSocialLinks] = useState<AuthorSocialLinkDraft[]>([]);
  const [status, setStatus] = useState<PublishStatus>("PUBLISHED");
  const [formError, setFormError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await create.mutateAsync({
        slug,
        photoUrl,
        socialLinks: cleanSocialLinks(socialLinks),
        sortOrder: 0,
        status,
        // Both locales always written, so a reader on either side of the
        // language switch gets a real name. The BN box falls back to the EN
        // text rather than saving an empty name.
        translations: [
          { locale: "EN", name: nameEn, bio: bioEn || undefined },
          { locale: "BN", name: nameBn || nameEn, bio: bioBn || bioEn || undefined },
        ],
      });
      toast.push("Author created successfully!");
      router.push("/authors");
    } catch (err) {
      const msg = err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to create author";
      setFormError(msg);
      toast.push(msg);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200/60 bg-white p-4 shadow-xs">
        <div className="flex items-center gap-3">
          <Link
            href="/authors"
            aria-label="Back to authors"
            className="grid h-9 w-9 place-items-center rounded-xl text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900"
          >
            <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <line x1="19" y1="12" x2="5" y2="12" />
              <polyline points="12 19 5 12 12 5" />
            </svg>
          </Link>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-extrabold text-slate-900">Create New Author</h1>
            {nameEn && (
              <span className="max-w-[260px] truncate rounded-full border border-[#a7f3d0] bg-[#ecfdf5] px-3 py-0.5 text-xs font-bold text-[#059669]">
                {nameEn}
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <Link href="/authors">
            <button type="button" className={cancelButtonClass}>
              Cancel
            </button>
          </Link>
          <button
            type="submit"
            disabled={create.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#044e37] px-5 text-xs font-bold text-[#fbbf24] shadow-xs transition-all duration-150 hover:bg-[#033c2a] disabled:opacity-50"
          >
            {create.isPending ? "Creating…" : "Create Author"}
          </button>
        </div>
      </div>

      <AuthorFormFields
        nameEn={nameEn}
        setNameEn={setNameEn}
        nameBn={nameBn}
        setNameBn={setNameBn}
        bioEn={bioEn}
        setBioEn={setBioEn}
        bioBn={bioBn}
        setBioBn={setBioBn}
        slug={slug}
        setSlug={setSlug}
        photoUrl={photoUrl}
        setPhotoUrl={setPhotoUrl}
        socialLinks={socialLinks}
        setSocialLinks={setSocialLinks}
        status={status}
        setStatus={setStatus}
        formError={formError}
      />
    </form>
  );
}
