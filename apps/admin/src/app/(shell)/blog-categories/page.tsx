"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useBlogCategories, useDeleteBlogCategory } from "@/hooks/useBlogCategories";

export default function BlogCategoriesPage() {
  const { data: categories, isLoading } = useBlogCategories();
  const deleteCategory = useDeleteBlogCategory();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{categories?.length ?? 0} blog categories</p>
        <Link href="/blog-categories/new">
          <Button variant="primary">Add category</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {categories && categories.length === 0 && <p className="text-sm text-muted">No blog categories yet.</p>}

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
