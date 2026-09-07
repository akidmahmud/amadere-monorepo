"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useBrands, useDeleteBrand } from "@/hooks/useBrands";
import { PermissionButton } from "@/components/PermissionButton";

export default function BrandsPage() {
  const { data: brands, isLoading } = useBrands();
  const deleteBrand = useDeleteBrand();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{brands?.length ?? 0} brands</p>
        <Link href="/brands/new">
          <PermissionButton requires="brand.create" variant="primary">Add brand</PermissionButton>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {brands && brands.length === 0 && <p className="text-sm text-muted">No brands yet.</p>}

      <div className="flex flex-col gap-3">
        {brands?.map((brand) => (
          <Card key={brand.id} className="flex items-center gap-3">
            {brand.logoUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={brand.logoUrl} alt="" className="h-10 w-10 rounded-inner border border-border object-contain" />
            )}
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">
                {brand.translations[0]?.name ?? brand.slug}
              </div>
              <div className="text-xs text-muted">
                {brand.slug} · {brand.status}
              </div>
            </div>
            <Link href={`/brands/${brand.id}`}>
              <PermissionButton requires="brand.update" type="button" variant="ghost">
                Edit
              </PermissionButton>
            </Link>
            <PermissionButton
              requires="brand.delete"
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${brand.translations[0]?.name ?? brand.slug}"?`)) deleteBrand.mutate(brand.id);
              }}
            >
              Delete
            </PermissionButton>
          </Card>
        ))}
      </div>
    </>
  );
}
