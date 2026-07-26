import type { Metadata } from "next";
import type { ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import {
  AdBannerSection,
  BentoBlogs,
  CategoryCard,
  CertificationRow,
  CircleBadgeBar,
  Carousel,
  FeaturedCategoriesSection,
  HeroCarousel,
  ProductCarouselSection,
  SectionHeading,
  TestimonialsBento,
  ViewAllLink,
  type ProductCarouselItem,
} from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { toApiLocale } from "@/lib/api-locale";
import type { components } from "@/lib/api/schema";
import { toProductCardData, toPromoVideoProductData } from "@/lib/product-card-mapper";
import { toDisplayImageUrl } from "@/lib/media";
import { toBlogCardData } from "@/lib/blog-mapper";
import { HealthConcernSection } from "@/components/HealthConcernSection";
import { ProductCarouselSectionClient } from "@/components/ProductCarouselSectionClient";
import { PromoVideoSectionClient } from "@/components/PromoVideoSectionClient";
import { TabbedCollectionCarouselSection } from "@/components/TabbedCollectionCarouselSection";
import { TopSellingProductsSectionClient } from "@/components/TopSellingProductsSectionClient";

// Shorter window than catalog/blog on purpose — admin-edited HomepageSections
// (B13) are meant to show up without a deploy; on-demand revalidation
// (src/app/api/revalidate) closes the gap for the interim minutes, once the
// backend actually calls it (see AGENTS.web.md §14 — that side doesn't exist yet).
export const revalidate = 300;

export function generateMetadata(): Metadata {
  return {
    alternates: { canonical: "/", languages: getLanguageAlternates("/") },
  };
}

function toBundleCardData(
  bundle: components["schemas"]["PublicBundleDto"],
): ProductCarouselItem {
  return {
    href: `/combos/${bundle.slug}`,
    name: bundle.name,
    price: bundle.bundlePrice ?? "0",
  };
}

// The swagger CLI plugin can't infer a literal union for bare enum fields on
// response DTOs (see AGENTS.web.md changelog) — every enum comes out as
// `Record<string, never>` in the generated schema. Re-typed locally rather
// than fixing it repo-wide for one field.
type HomepageSectionType =
  | "HERO_BANNER"
  | "PRODUCT_COLLECTION"
  | "BANNER_STRIP"
  | "CATEGORY_SHOWCASE"
  | "BLOG_TEASER"
  | "CERTIFICATION_ROW"
  | "TESTIMONIAL_BENTO"
  | "CIRCLE_BADGE_BAR"
  | "PROMO_VIDEO"
  | "TABBED_COLLECTION_CAROUSEL"
  | "AD_BANNER"
  | "FEATURED_CATEGORIES"
  | "TOP_SELLING_PRODUCTS";

type HomepageSection = Omit<
  components["schemas"]["PublicHomepageSectionDto"],
  "type" | "config" | "promoVideoProducts" | "topSellingProducts"
> & {
  type: HomepageSectionType;
  config: Record<string, unknown>;
  promoVideoProducts: (components["schemas"]["PublicProductDto"] | null)[] | null;
  topSellingProducts: (components["schemas"]["PublicProductDto"] | null)[] | null;
};

// Same 1440px container / 16px-mobile-24px-desktop gutter as the header, nav,
// hero, and every other section on this page (amader-header-spec.md §5) —
// previously a much wider, differently-padded box (max-w-1920 + up to 112px
// side padding), which made every section below the hero visibly narrower
// and more inset than the header/hero/Featured-Categories/Top-Selling rows
// above it. One container for the whole homepage now.
const WRAPPER = "mx-auto w-full max-w-[1440px] px-4 md:px-6";

function renderSection(
  section: HomepageSection,
  ctx: {
    categories: components["schemas"]["PublicCategoryDto"][];
    blogPosts: components["schemas"]["PublicBlogPostSummaryDto"][];
  },
): ReactNode {
  const { config } = section;

  switch (section.type) {
    case "HERO_BANNER": {
      const slides = config.slides as { imageUrl: string; linkUrl?: string }[] | undefined;
      return (
        // Full-bleed edge-to-edge (no padding, no top gap), unlike every
        // other section — kept only the max-width cap for ultra-wide
        // monitors.
        <div className="mx-auto w-full max-w-[1920px]" key={section.id}>
          <HeroCarousel
            slides={slides}
            stripImageUrl={config.stripImageUrl as string | undefined}
            stripLinkUrl={config.stripLinkUrl as string | undefined}
            linkComponent={AppLink}
          />
        </div>
      );
    }

    case "PRODUCT_COLLECTION": {
      if (!section.collection || section.collection.products.length === 0) return null;
      return (
        <div className={WRAPPER} key={section.id}>
          <ProductCarouselSectionClient
            heading={section.heading ?? section.collection.name}
            products={section.collection.products.map(toProductCardData)}
            viewAllHref={`/collections/${section.collection.slug}`}
            viewAllLabel="View All"
            visibleCount={5}
            autoplayMs={4000}
          />
        </div>
      );
    }

    case "BANNER_STRIP": {
      const imageUrl = config.imageUrl as string | undefined;
      if (!imageUrl) return null;
      const linkUrl = config.linkUrl as string | undefined;
      // Fixed 1690x195 box per design spec — crops to fill (object-cover),
      // never distorts, regardless of the uploaded image's real aspect ratio.
      const image = (
        <div className="relative mx-auto h-[195px] w-full max-w-[1690px] overflow-hidden rounded-[20px] bg-gray">
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      );
      return (
        <div className={`${WRAPPER} py-5`} key={section.id}>
          {linkUrl ? <AppLink href={linkUrl}>{image}</AppLink> : image}
        </div>
      );
    }

    case "CATEGORY_SHOWCASE": {
      const categoryIds = config.categoryIds as number[] | undefined;
      const selected = categoryIds?.length
        ? ctx.categories.filter((c) => categoryIds.includes(c.id))
        : ctx.categories;
      if (selected.length === 0) return null;
      return (
        <div className={`${WRAPPER} py-9`} key={section.id}>
          <SectionHeading>{section.heading ?? "Our Range of Categories"}</SectionHeading>
          <Carousel autoplayMs={4000}>
            {selected.map((category) => (
              <CategoryCard
                key={category.id}
                href={`/categories/${category.slug}`}
                name={category.name}
                imageUrl={toDisplayImageUrl(category.imageUrl)}
                linkComponent={AppLink}
              />
            ))}
          </Carousel>
          <ViewAllLink href="/categories" linkComponent={AppLink}>
            View All
          </ViewAllLink>
        </div>
      );
    }

    case "FEATURED_CATEGORIES": {
      const categoryIds = config.categoryIds as number[] | undefined;
      const selected = categoryIds?.length
        ? ctx.categories.filter((c) => categoryIds.includes(c.id))
        : ctx.categories;
      if (selected.length === 0) return null;
      return (
        <FeaturedCategoriesSection
          key={section.id}
          heading={section.heading ?? undefined}
          items={selected.map((category) => ({
            href: `/categories/${category.slug}`,
            name: category.name,
            imageUrl: toDisplayImageUrl(category.imageUrl),
          }))}
          linkComponent={AppLink}
        />
      );
    }

    case "TOP_SELLING_PRODUCTS": {
      const configItems = (config.items as { productId?: number; showBadge?: boolean }[] | undefined) ?? [];
      const resolvedProducts = section.topSellingProducts ?? [];
      const items = configItems
        .map((item, i) => {
          const product = resolvedProducts[i];
          if (!product) return null;
          return { ...toProductCardData(product), showBadge: item.showBadge };
        })
        .filter((item): item is NonNullable<typeof item> => item !== null);
      if (items.length === 0) return null;
      return (
        <TopSellingProductsSectionClient key={section.id} heading={section.heading ?? undefined} items={items} />
      );
    }

    case "BLOG_TEASER": {
      const postIds = config.postIds as number[] | undefined;
      // When the admin explicitly picked posts (postIds), show all of them —
      // `config.limit` is a leftover default for the "latest N posts" mode
      // and shouldn't silently drop an explicitly-selected post.
      const limit = postIds?.length ?? (config.limit as number | undefined) ?? 6;
      const selected = (postIds?.length ? ctx.blogPosts.filter((p) => postIds.includes(p.id)) : ctx.blogPosts).slice(
        0,
        limit,
      );
      if (selected.length === 0) return null;
      return (
        <div className={`${WRAPPER} py-9`} key={section.id}>
          <SectionHeading>{section.heading ?? "আমাদের ব্লগ"}</SectionHeading>
          <BentoBlogs
            posts={selected.map((post) => toBlogCardData(post))}
            viewAllHref="/blog"
            viewAllLabel="View All"
            linkComponent={AppLink}
          />
        </div>
      );
    }

    case "CERTIFICATION_ROW": {
      const rawItems = config.items as { imageUrl?: string; label?: string }[] | undefined;
      const items = rawItems?.map((item) => ({ imageUrl: toDisplayImageUrl(item.imageUrl), label: item.label }));
      return (
        <div className={`${WRAPPER} py-9`} key={section.id}>
          <SectionHeading>{section.heading ?? "Our Certification"}</SectionHeading>
          <CertificationRow items={items} />
        </div>
      );
    }

    case "TESTIMONIAL_BENTO": {
      const rawReviews = config.reviews as
        | { quote: string; name: string; role?: string; avatarUrl?: string; rating?: number }[]
        | undefined;
      const reviews = rawReviews?.map((r) => ({ ...r, avatarUrl: toDisplayImageUrl(r.avatarUrl) }));
      if (!reviews || reviews.length === 0) return null;
      return (
        <div className={`${WRAPPER} py-9`} key={section.id}>
          <SectionHeading>{section.heading ?? "500+ Happy Clients"}</SectionHeading>
          <TestimonialsBento reviews={reviews} />
        </div>
      );
    }

    case "CIRCLE_BADGE_BAR": {
      const items = config.items as { imageUrl?: string; label: string }[] | undefined;
      if (!items || items.length === 0) return null;
      return (
        <div className={WRAPPER} key={section.id}>
          <CircleBadgeBar items={items} />
        </div>
      );
    }

    case "PROMO_VIDEO": {
      const items = config.videos as
        | { source: "YOUTUBE" | "TIKTOK" | "INSTAGRAM" | "R2" | "GIF"; url: string; thumbnailUrl?: string }[]
        | undefined;
      if (!items || items.length === 0) return null;
      const products = (section.promoVideoProducts ?? items.map(() => null)).map((p) =>
        p ? toPromoVideoProductData(p) : null,
      );
      return (
        <div className={WRAPPER} key={section.id}>
          <PromoVideoSectionClient heading={section.heading ?? undefined} items={items} products={products} />
        </div>
      );
    }

    case "AD_BANNER": {
      const images = config.images as { imageUrl: string; linkUrl?: string }[] | undefined;
      if (!images || images.length === 0) return null;
      return (
        <div className={`${WRAPPER} py-5`} key={section.id}>
          <AdBannerSection images={images} linkComponent={AppLink} />
        </div>
      );
    }

    // No longer tabbed — a single-collection product strip matching
    // amader-home-top.html's "Amader Modhu — Natural Honey" design (dropped
    // the pill-tab switcher + promo tile; resolves via the same
    // collectionId FK as PRODUCT_COLLECTION now instead of config.tabs).
    case "TABBED_COLLECTION_CAROUSEL": {
      if (!section.collection || section.collection.products.length === 0) return null;
      const items = section.collection.products.map((product) => ({
        ...toProductCardData(product),
        isFeatured: product.isFeatured,
      }));
      return (
        <TabbedCollectionCarouselSection
          key={section.id}
          title={section.heading ?? section.collection.name}
          viewAllHref={`/collections/${section.collection.slug}`}
          items={items}
        />
      );
    }

    default:
      return null;
  }
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const localeParam = toApiLocale(locale);

  const [sectionsRes, bundlesRes, tagsRes, categoriesRes, blogRes] = await Promise.all([
    safeGet("/api/v1/homepage-sections", { params: { query: { locale: localeParam } } }),
    safeGet("/api/v1/product-bundles", {
      params: { query: { locale: localeParam, pageSize: 8 } },
    }),
    safeGet("/api/v1/tags", {
      params: { query: { locale: localeParam, pageSize: 6 } },
    }),
    safeGet("/api/v1/categories", {
      params: { query: { locale: localeParam, pageSize: 10 } },
    }),
    safeGet("/api/v1/blog-posts", {
      params: { query: { locale: localeParam, pageSize: 6 } },
    }),
  ]);

  const sections = (sectionsRes.data ?? []) as unknown as HomepageSection[];
  const bundles = (bundlesRes.data?.items ?? []).map(toBundleCardData);
  const categories = (categoriesRes.data?.items ??
    []) as components["schemas"]["PublicCategoryDto"][];
  const blogPosts = (blogRes.data?.items ??
    []) as components["schemas"]["PublicBlogPostSummaryDto"][];

  const tags = (tagsRes.data?.items ??
    []) as components["schemas"]["PublicTagDto"][];
  const firstTag = tags[0];
  const firstTagProducts = firstTag
    ? ((
        await safeGet("/api/v1/products", {
          params: {
            query: { locale: localeParam, tagIds: [firstTag.id], pageSize: 8 },
          },
        })
      ).data?.items ?? [])
    : [];

  return (
    <main className="flex-1">
      {sections.map((section) => renderSection(section, { categories, blogPosts }))}

      {bundles.length > 0 && (
        <div className={WRAPPER}>
          <ProductCarouselSection
            heading="Super Saver Combos"
            products={bundles}
            viewAllHref="/combos"
            viewAllLabel="View All"
            linkComponent={AppLink}
            autoplayMs={4000}
          />
        </div>
      )}

      {firstTag && (
        <div className={WRAPPER}>
          <HealthConcernSection
            heading="Shop By Health Concern"
            viewAllLabel="View All"
            tags={tags.map((t) => ({ id: t.id, label: t.name }))}
            initialTagId={firstTag.id}
            initialProducts={firstTagProducts.map(toProductCardData)}
          />
        </div>
      )}
    </main>
  );
}
