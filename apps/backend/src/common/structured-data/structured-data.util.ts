// schema.org JSON-LD builders (AGENTS.md §6/§9: "structured data output
// (Product/Review/FAQ/Article/Video/Breadcrumb)"). Each returns a plain
// object ready to be embedded as-is in a <script type="application/ld+json">
// tag by the frontend — this backend does not render HTML.

export interface ProductJsonLdInput {
  name: string;
  description: string | null;
  imageUrls: string[];
  sku: string | null;
  brandName: string | null;
  price: string | null;
  currency: string;
  inStock: boolean;
  canonicalUrl: string;
  aggregateRating: { average: number; count: number } | null;
}

export function buildProductJsonLd(
  input: ProductJsonLdInput,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: input.name,
    description: input.description ?? undefined,
    image: input.imageUrls.length ? input.imageUrls : undefined,
    sku: input.sku ?? undefined,
    brand: input.brandName
      ? { '@type': 'Brand', name: input.brandName }
      : undefined,
    offers: input.price
      ? {
          '@type': 'Offer',
          url: input.canonicalUrl,
          priceCurrency: input.currency,
          price: input.price,
          availability: input.inStock
            ? 'https://schema.org/InStock'
            : 'https://schema.org/OutOfStock',
        }
      : undefined,
    aggregateRating: input.aggregateRating
      ? {
          '@type': 'AggregateRating',
          ratingValue: input.aggregateRating.average,
          reviewCount: input.aggregateRating.count,
        }
      : undefined,
  };
}

export interface ArticleJsonLdInput {
  headline: string;
  description: string | null;
  imageUrl: string | null;
  authorName: string;
  datePublished: Date | null;
  dateModified: Date;
  canonicalUrl: string;
}

export function buildArticleJsonLd(
  input: ArticleJsonLdInput,
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: input.headline,
    description: input.description ?? undefined,
    image: input.imageUrl ?? undefined,
    author: { '@type': 'Person', name: input.authorName },
    datePublished: input.datePublished?.toISOString(),
    dateModified: input.dateModified.toISOString(),
    mainEntityOfPage: input.canonicalUrl,
  };
}

export function buildFaqPageJsonLd(
  faqs: { question: string; answer: string }[],
): Record<string, unknown> | null {
  if (faqs.length === 0) return null;
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqs.map((f) => ({
      '@type': 'Question',
      name: f.question,
      acceptedAnswer: { '@type': 'Answer', text: f.answer },
    })),
  };
}

export function buildBreadcrumbJsonLd(
  crumbs: { name: string; url: string }[],
): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: crumbs.map((c, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: c.name,
      item: c.url,
    })),
  };
}

export function buildVideoObjectJsonLd(input: {
  name: string;
  description: string | null;
  thumbnailUrl: string | null;
  videoUrl: string;
  uploadDate: Date;
}): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'VideoObject',
    name: input.name,
    description: input.description ?? input.name,
    thumbnailUrl: input.thumbnailUrl ?? undefined,
    contentUrl: input.videoUrl,
    uploadDate: input.uploadDate.toISOString(),
  };
}
