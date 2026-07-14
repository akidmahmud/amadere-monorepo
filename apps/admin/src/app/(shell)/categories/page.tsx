"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useCategories, useDeleteCategory } from "@/hooks/useCategories";

export default function CategoriesPage() {
  const { data: categories, isLoading } = useCategories();
  const deleteCategory = useDeleteCategory();

  function nameFor(id: number | null) {
    return categories?.find((c) => c.id === id)?.translations[0]?.name;
  }

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{categories?.length ?? 0} categories</p>
        <Link href="/categories/new">
          <Button variant="primary">Add category</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {categories && categories.length === 0 && <p className="text-sm text-muted">No categories yet.</p>}

      <div className="flex flex-col gap-3">
        {categories?.map((category) => (
          <Card key={category.id} className="flex items-center gap-3">
            {category.imageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={category.imageUrl}
                alt=""
                className="h-10 w-10 rounded-inner border border-border object-cover"
              />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">
                {category.translations[0]?.name ?? category.slug}
              </div>
              <div className="text-xs text-muted">
                {category.slug} · {category.status}
                {category.parentId && ` · under ${nameFor(category.parentId) ?? category.parentId}`}
              </div>
            </div>
            <Link href={`/categories/${category.id}`}>
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
