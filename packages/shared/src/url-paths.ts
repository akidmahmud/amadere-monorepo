// Single source of truth for every public entity's frontend path
// (AGENTS.md §9 "every public entity: stable slug + SeoMeta + sitemap
// inclusion"). Used by the backend's sitemap.service.ts and by the B12
// migration's redirect-map builder — both must agree on these paths, so
// this is the one place they're defined, not duplicated.
export function productPath(slug: string): string {
  return `/products/${slug}`;
}

export function categoryPath(slug: string): string {
  return `/categories/${slug}`;
}

export function brandPath(slug: string): string {
  return `/brands/${slug}`;
}

export function tagPath(slug: string): string {
  return `/tags/${slug}`;
}

export function productBundlePath(slug: string): string {
  return `/product-bundles/${slug}`;
}

export function blogPostPath(slug: string): string {
  return `/blog/${slug}`;
}

export function blogCategoryPath(slug: string): string {
  return `/blog/category/${slug}`;
}

export function blogTagPath(slug: string): string {
  return `/blog/tag/${slug}`;
}

export function pagePath(slug: string): string {
  return `/${slug}`;
}
