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
import { HealthConcernSection } from "@/components/HealthConcernSection";
import { ProductCarouselSectionClient } from "@/components/ProductCarouselSectionClient";
import { PromoVideoSectionClient } from "@/components/PromoVideoSectionClient";
import { TabbedCollectionCarouselSection } from "@/components/TabbedCollectionCarouselSection";

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
  | "AD_BANNER";

type HomepageSection = Omit<
  components["schemas"]["PublicHomepageSectionDto"],
  "type" | "config" | "tabCollections" | "promoVideoProducts"
> & {
  type: HomepageSectionType;
  config: Record<string, unknown>;
  tabCollections: (components["schemas"]["PublicCollectionDto"] | null)[] | null;
  promoVideoProducts: (components["schemas"]["PublicProductDto"] | null)[] | null;
};

interface TabbedCarouselTabConfig {
  collectionId?: number;
  tabLabel?: { EN: string; BN: string };
  promoImageUrl?: string;
  promoHeading?: { EN: string; BN: string };
  promoBlurb?: { EN: string; BN: string };
  viewAllUrl?: string;
}

// Full window width on real desktop screens (only caps on very wide/ultra-wide
// monitors) instead of the 1180px content box used elsewhere on the site —
// homepage sections are meant to fill the window, not float in a narrow
// column with big empty gutters either side.
const WRAPPER = "mx-auto w-full max-w-[1920px] px-5 sm:px-8 lg:px-12";

function renderSection(
  section: HomepageSection,
  ctx: {
    categories: components["schemas"]["PublicCategoryDto"][];
    blogPosts: components["schemas"]["PublicBlogPostSummaryDto"][];
    locale: "EN" | "BN";
  },
): ReactNode {
  const { config } = section;

  switch (section.type) {
    case "HERO_BANNER": {
      const slides = config.slides as { imageUrl: string; linkUrl?: string }[] | undefined;
      return (
        <div className={`${WRAPPER} pt-5.5`} key={section.id}>
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
      // Source images are ideally 1690×195 — aspect-ratio instead of a flat
      // height keeps the full image visible at that ratio on any viewport
      // width. Same blurred-fill treatment as HeroCarousel: any off-ratio
      // image still shows in full, uncropped, with a softly blurred copy of
      // itself filling the rest instead of empty gaps.
      const image = (
        <div className="relative aspect-[1690/195] w-full overflow-hidden rounded-2xl bg-gray">
          <img
            src={imageUrl}
            alt=""
            aria-hidden="true"
            className="absolute inset-0 h-full w-full scale-110 object-cover opacity-70 blur-2xl"
          />
          <img src={imageUrl} alt="" className="relative h-full w-full object-contain" />
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
          <Carousel>
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

    case "BLOG_TEASER": {
      const postIds = config.postIds as number[] | undefined;
      const limit = (config.limit as number | undefined) ?? 5;
      const selected = (postIds?.length ? ctx.blogPosts.filter((p) => postIds.includes(p.id)) : ctx.blogPosts).slice(
        0,
        limit,
      );
      if (selected.length === 0) return null;
      return (
        <div className={`${WRAPPER} py-9`} key={section.id}>
          <SectionHeading>{section.heading ?? "Blogs"}</SectionHeading>
          <BentoBlogs
            posts={selected.map((post) => ({
              href: `/blog/${post.slug}`,
              title: post.title,
              imageUrl: toDisplayImageUrl(post.imageUrl),
            }))}
            linkComponent={AppLink}
          />
        </div>
      );
    }

    case "CERTIFICATION_ROW": {
      const items = config.items as { imageUrl?: string; label?: string }[] | undefined;
      return (
        <div className={`${WRAPPER} py-9`} key={section.id}>
          <SectionHeading>{section.heading ?? "Our Certification"}</SectionHeading>
          <CertificationRow items={items} />
        </div>
      );
    }

    case "TESTIMONIAL_BENTO": {
      return (
        <div className={`${WRAPPER} py-9`} key={section.id}>
          <SectionHeading>{section.heading ?? "500+ Happy Clients"}</SectionHeading>
          <TestimonialsBento
            mainImageUrl={config.mainImageUrl as string | undefined}
            mainVideoUrl={config.mainVideoUrl as string | undefined}
            photos={config.photos as string[] | undefined}
          />
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

    case "TABBED_COLLECTION_CAROUSEL": {
      const tabConfigs = (config.tabs as TabbedCarouselTabConfig[] | undefined) ?? [];
      const resolved = section.tabCollections ?? [];
      const tabs = tabConfigs
        .map((tabConfig, i) => {
          const collection = resolved[i];
          if (!collection) return null;
          const products = collection.products.map(toProductCardData);
          return {
            key: String(i),
            label: tabConfig.tabLabel?.[ctx.locale] || collection.name,
            promoImageUrl: tabConfig.promoImageUrl || products[0]?.imageUrl,
            promoHeading: tabConfig.promoHeading?.[ctx.locale] || collection.name,
            promoBlurb: tabConfig.promoBlurb?.[ctx.locale] || collection.description || undefined,
            viewAllHref: tabConfig.viewAllUrl || `/collections/${collection.slug}`,
            products,
          };
        })
        .filter((tab): tab is NonNullable<typeof tab> => tab !== null);
      if (tabs.length === 0) return null;
      return (
        <div className={WRAPPER} key={section.id}>
          <TabbedCollectionCarouselSection
            heading={section.heading ?? undefined}
            tabs={tabs}
            defaultActiveIndex={(config.defaultActiveTab as number | undefined) ?? 0}
          />
        </div>
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
      params: { query: { locale: localeParam, pageSize: 5 } },
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
      {sections.map((section) => renderSection(section, { categories, blogPosts, locale: localeParam }))}

      {bundles.length > 0 && (
        <div className={WRAPPER}>
          <ProductCarouselSection
            heading="Super Saver Combos"
            products={bundles}
            viewAllHref="/combos"
            viewAllLabel="View All"
            linkComponent={AppLink}
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
