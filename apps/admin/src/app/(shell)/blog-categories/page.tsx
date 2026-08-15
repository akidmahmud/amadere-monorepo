"use client";

import { useState } from "react";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useBlogCategories, useDeleteBlogCategory } from "@/hooks/useBlogCategories";

export default function BlogCategoriesPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: categories, isLoading } = useBlogCategories(searchQuery);
  const deleteCategory = useDeleteBlogCategory();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-secondary">{categories?.length ?? 0} blog categories</p>
          <input
            type="text"
            placeholder="Search blog categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-[38px] w-[220px] rounded-inner border border-border bg-surface px-3 text-[0.76rem] text-text outline-none focus:border-brand-500"
          />
        </div>
        <Link href="/blog-categories/new">
          <Button variant="primary">Add category</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {categories && categories.length === 0 && (
        <p className="text-sm text-muted">
          {searchQuery ? `No blog categories matching "${searchQuery}".` : "No blog categories yet."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {categories?.map((category) => (
          <Card key={category.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">
                {category.translations[0]?.name ?? category.slug}
              </div>
              <div className="text-xs text-muted">{category.slug} · {category.status}</div>
            </div>
            <Link href={`/blog-categories/${category.id}`}>
              <Button type="button" variant="ghost">
                Edit
              </Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${category.translations[0]?.name ?? category.slug}"?`))
                  deleteCategory.mutate(category.id);
              }}
            >
              Delete
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
