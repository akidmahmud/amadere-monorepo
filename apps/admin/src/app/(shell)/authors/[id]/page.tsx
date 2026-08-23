"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { FormSkeleton } from "@amader/admin-ui";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { useAuthor, useDeleteAuthor, useUpdateAuthor } from "@/hooks/useAuthors";
import type { PublishStatus } from "@/hooks/useBrands";
import { useToast } from "@/components/ToastProvider";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { AuthorFormFields, cleanSocialLinks, type AuthorSocialLinkDraft } from "@/components/authors/AuthorFormFields";

const deleteIcon = (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

const cancelButtonClass =
  "inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-slate-200/80 bg-white px-4 text-xs font-bold text-slate-700 transition-colors duration-150 hover:border-rose-300 hover:bg-rose-50 hover:text-rose-700 disabled:cursor-not-allowed disabled:opacity-50 shadow-2xs";

export default function EditAuthorPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const authorId = Number(id);
  const router = useRouter();
  const { data: author, isLoading } = useAuthor(authorId);
  const update = useUpdateAuthor(authorId);
  const deleteAuthor = useDeleteAuthor();
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
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);

  // The query resolves asynchronously, so useState initialisers alone never
  // see the real data — same seed-on-load effect every other edit page uses.
  useEffect(() => {
    if (!author) return;
    setSlug(author.slug);
    const en = author.translations.find((t) => String(t.locale) === "EN");
    const bn = author.translations.find((t) => String(t.locale) === "BN");
    setNameEn(en?.name ?? author.translations[0]?.name ?? "");
    setNameBn(bn?.name ?? "");
    setBioEn(en?.bio ?? author.translations[0]?.bio ?? "");
    setBioBn(bn?.bio ?? "");
    setPhotoUrl(author.photoUrl ?? undefined);
    setSocialLinks(author.socialLinks.map((l) => ({ icon: l.icon as AuthorSocialLinkDraft["icon"], url: l.url })));
    setStatus(author.status);
  }, [author]);

  async function handleDelete() {
    try {
      await deleteAuthor.mutateAsync(authorId);
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to delete author");
      return;
    }
    toast.push(`Author "${nameEn || author?.slug || "Author"}" deleted.`);
    router.push("/authors");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      await update.mutateAsync({
        slug,
        photoUrl,
        socialLinks: cleanSocialLinks(socialLinks),
        status,
        translations: [
          { locale: "EN", name: nameEn, bio: bioEn || undefined },
          { locale: "BN", name: nameBn || nameEn, bio: bioBn || bioEn || undefined },
        ],
      });
      toast.push("Author saved successfully!");
      router.push("/authors");
    } catch (err) {
      const msg = err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to save author";
      setFormError(msg);
      toast.push(msg);
    }
  }

  if (isLoading || !author) return <FormSkeleton />;

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
            <h1 className="text-lg font-extrabold text-slate-900">Edit Author</h1>
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
            type="button"
            aria-label="Delete author"
            title="Delete author"
            onClick={() => setConfirmDeleteOpen(true)}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700 shadow-2xs transition-all hover:bg-rose-600 hover:text-white"
          >
            {deleteIcon}
          </button>
          <button
            type="submit"
            disabled={update.isPending}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#044e37] px-5 text-xs font-bold text-[#fbbf24] shadow-xs transition-all duration-150 hover:bg-[#033c2a] disabled:opacity-50"
          >
            {update.isPending ? "Saving…" : "Save Changes"}
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

      <ConfirmDialog
        open={confirmDeleteOpen}
        onClose={() => setConfirmDeleteOpen(false)}
        onConfirm={handleDelete}
        pending={deleteAuthor.isPending}
        title={`Delete "${nameEn || author.slug}"?`}
        description={
          author.productCount > 0
            ? `${author.productCount} product(s) link to this author and will lose their Author tab.`
            : "Are you sure you want to delete this author?"
        }
      />
    </form>
  );
}
