"use client";

import { DefaultLink, type LinkComponent } from "../lib/link-component";

export interface CategoryCardProps {
  href: string;
  name: string;
  imageUrl?: string;
  linkComponent?: LinkComponent;
}

export function CategoryCard({
  href,
  name,
  imageUrl,
  linkComponent: Link = DefaultLink,
}: CategoryCardProps) {
  return (
    <Link href={href} className="block w-[200px] shrink-0">
      <div className="aspect-square rounded-brand bg-beige">
        {imageUrl && (
          <img
            src={imageUrl}
            alt={name}
            loading="lazy"
            className="h-full w-full rounded-brand object-cover"
          />
        )}
      </div>
      <p className="mt-2 truncate text-center font-ui text-sm font-medium text-ink">
        {name}
      </p>
    </Link>
  );
}
