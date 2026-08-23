"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useAuthors, useDeleteAuthor } from "@/hooks/useAuthors";

export default function AuthorsPage() {
  const { data: authors, isLoading } = useAuthors();
  const deleteAuthor = useDeleteAuthor();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{authors?.length ?? 0} authors</p>
        <Link href="/authors/new">
          <Button variant="primary">Add author</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {authors && authors.length === 0 && <p className="text-sm text-muted">No authors yet.</p>}

      <div className="flex flex-col gap-3">
        {authors?.map((author) => {
          const name = author.translations[0]?.name ?? author.slug;
          return (
            <Card key={author.id} className="flex items-center gap-3">
              {author.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={author.photoUrl} alt="" className="h-10 w-10 rounded-full border border-border object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-text">{name}</div>
                <div className="text-xs text-muted">
                  {author.slug} · {author.status} · {author.productCount} book{author.productCount === 1 ? "" : "s"} ·{" "}
                  {author.socialLinks.length} social link{author.socialLinks.length === 1 ? "" : "s"}
                </div>
              </div>
              <Link href={`/authors/${author.id}`}>
                <Button type="button" variant="ghost">
                  Edit
                </Button>
              </Link>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  // productCount is surfaced here because deleting an author
                  // leaves every book by them without an Author tab — worth
                  // saying out loud before the confirm, not after.
                  const warning =
                    author.productCount > 0
                      ? `\n\n${author.productCount} product(s) link to this author and will lose their Author tab.`
                      : "";
                  if (confirm(`Delete "${name}"?${warning}`)) deleteAuthor.mutate(author.id);
                }}
              >
                Delete
              </Button>
            </Card>
          );
        })}
      </div>
    </>
  );
}
