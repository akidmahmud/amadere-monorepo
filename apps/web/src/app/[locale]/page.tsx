import type { Metadata } from "next";
import { Fragment, type ReactNode } from "react";
import { setRequestLocale } from "next-intl/server";
import {
  AdBannerSection,
  BlogCardGrid,
  CategoryCard,
  CertificationRow,
  CircleBadgeBar,
  Carousel,
  FeaturedCategoriesSection,
  HeroCarousel,
  HomeBannerTwo,
  SectionHeading,
  TestimonialsBento,
  ViewAllLink,
} from "@amader/ui";
import { AppLink } from "@/components/AppLink";
import { getLanguageAlternates } from "@/i18n/alternates";
import { safeGet } from "@/lib/api/client";
import { LazySectionProducts } from "@/components/LazySectionProducts";
import { toApiLocale } from "@/lib/api-locale";
import type { components } from "@/lib/api/schema";
import {
  toProductCardData,
  toPromoVideoProductData,
} from "@/lib/product-card-mapper";
import { IMG, toDisplayImageUrl } from "@/lib/media";
import { toBlogCardData } from "@/lib/blog-mapper";
import { FeaturedDealsSectionClient } from "@/components/FeaturedDealsSectionClient";
import { HealthConcernSection } from "@/components/HealthConcernSection";
import { NewsletterBanner } from "@/components/NewsletterBanner";
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
  | "TABBED_COLLECTION_CAROUSEL"
  | "AD_BANNER"
  | "FEATURED_CATEGORIES"
  | "TOP_SELLING_PRODUCTS"
  | "JUST_FOR_YOU"
  | "FEATURED_DEALS"
  | "HOME_BANNER_TWO";

type HomepageSection = Omit<
  components["schemas"]["PublicHomepageSectionDto"],
  | "type"
  | "config"
  | "topSellingProducts"
  | "justForYouProducts"
  | "featuredDealsProducts"
> & {
  type: HomepageSectionType;
  config: Record<string, unknown>;
  topSellingProducts:
    (components["schemas"]["PublicProductDto"] | null)[] | null;
  justForYouProducts:
    (components["schemas"]["PublicProductDto"] | null)[] | null;
  featuredDealsProducts:
    (components["schemas"]["PublicProductDto"] | null)[] | null;
};

// Fixed homepage position now (§ "Promo Videos" is no longer a reorderable
// HomepageSection type) — its own type, its own fetch, spliced into the
// section render list at a fixed index rather than sorted in by sortOrder.
type PublicPromoVideo = components["schemas"]["PublicPromoVideoDto"] & {
  source:
    | "YOUTUBE"
    | "TIKTOK"
    | "INSTAGRAM"
    | "FACEBOOK"
    | "CUSTOM_URL"
    | "R2"
    | "GIF";
};

// Same 1440px container / 16px-mobile-24px-desktop gutter as the header, nav,
// hero, and every other section on this page (amader-header-spec.md §5) —
// previously a much wider, differently-padded box (max-w-1920 + up to 112px
// side padding), which made every section below the hero visibly narrower
// and more inset than the header/hero/Featured-Categories/Top-Selling rows
// above it. One container for the whole homepage now.
const WRAPPER = "mx-auto w-full max-w-[1440px] px-4 md:px-6";
// 1/8 of WRAPPER's side padding (halved three times) — Ad Banner/
// Certification Row/Blog Teaser/Testimonial Bento/Exclusive Deals only, per
// request; every other WRAPPER section keeps the full px-4/md:px-6.
const WRAPPER_HALF = "mx-auto w-full max-w-[1440px] px-[2px] md:px-[3px]";

function renderSection(
  section: HomepageSection,
  ctx: {
    categories: components["schemas"]["PublicCategoryDto"][];
    blogPosts: components["schemas"]["PublicBlogPostSummaryDto"][];
    // Needed by the lazily-loaded product rows, which fetch their own data
    // client-side and so must be told which locale to ask for.
    locale: "EN" | "BN";
  },
): ReactNode {
  const { config } = section;
  const localeParam = ctx.locale;

  switch (section.type) {
    case "HERO_BANNER": {
      // Admin-uploaded banner art goes straight into a raw <img>, so it has
      // to be routed through the CDN here or the browser gets the original
      // upload at full size.
      const slides = (
        config.slides as { imageUrl: string; linkUrl?: string }[] | undefined
      )?.map((s) => ({
        ...s,
        imageUrl: toDisplayImageUrl(s.imageUrl, IMG.banner) ?? s.imageUrl,
      }));
      // sideBanners (array, multiple) supersedes the old singular
      // stripImageUrl/stripLinkUrl — fall back to wrapping those as a
      // one-item array so sections saved before this change keep rendering
      // their existing side banner unchanged.
      const sideBanners = (
        (config.sideBanners as
          { imageUrl: string; linkUrl?: string }[] | undefined) ??
        (config.stripImageUrl
          ? [
              {
                imageUrl: config.stripImageUrl as string,
                linkUrl: config.stripLinkUrl as string | undefined,
              },
            ]
          : undefined)
      )?.map((b) => ({
        ...b,
        imageUrl: toDisplayImageUrl(b.imageUrl, IMG.banner) ?? b.imageUrl,
      }));
      return (
        // Full-bleed edge-to-edge (no padding, no top gap), unlike every
        // other section — kept only the max-width cap for ultra-wide
        // monitors.
        <div className="mx-auto w-full max-w-[1920px]" key={section.id}>
          <HeroCarousel
            slides={slides}
            sideBanners={sideBanners}
            linkComponent={AppLink}
          />
        </div>
      );
    }

    case "HOME_BANNER_TWO": {
      const slides = (
        config.slides as
          | { imageUrl: string; mobileImageUrl?: string; linkUrl?: string }[]
          | undefined
      )?.map((s) => ({
        ...s,
        imageUrl: toDisplayImageUrl(s.imageUrl, IMG.banner) ?? s.imageUrl,
        mobileImageUrl: s.mobileImageUrl
          ? (toDisplayImageUrl(s.mobileImageUrl, IMG.banner) ??
            s.mobileImageUrl)
          : undefined,
      }));
      if (!slides || slides.length === 0) return null;
      return (
        <div className="mx-auto w-full max-w-[1920px]" key={section.id}>
          <HomeBannerTwo slides={slides} linkComponent={AppLink} />
        </div>
      );
    }

    case "PRODUCT_COLLECTION": {
      // `section.collection` is still resolved server-side, but shallowly —
      // name and slug only — so the heading and View All link render with the
      // page. Products arrive on scroll, and sold-out ones are dropped there
      // (the collection page still lists them).
      if (!section.collection) return null;
      return (
        <div className={WRAPPER} key={section.id}>
          <LazySectionProducts
            sectionId={section.id}
            locale={localeParam}
            variant="collection"
            heading={section.heading ?? section.collection.name}
            viewAllHref={`/collections/${section.collection.slug}`}
            viewAllLabel="View All"
          />
        </div>
      );
    }

    case "BANNER_STRIP": {
      const rawImageUrl = config.imageUrl as string | undefined;
      const imageUrl =
        toDisplayImageUrl(rawImageUrl, IMG.banner) ?? rawImageUrl;
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
          <SectionHeading>
            {section.heading ?? "Our Range of Categories"}
          </SectionHeading>
          <Carousel autoplayMs={4000}>
            {selected.map((category) => (
              <CategoryCard
                key={category.id}
                href={`/categories/${category.slug}`}
                name={category.name}
                imageUrl={toDisplayImageUrl(category.imageUrl, IMG.card)}
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
            imageUrl: toDisplayImageUrl(category.imageUrl, IMG.card),
          }))}
          linkComponent={AppLink}
        />
      );
    }

    case "TOP_SELLING_PRODUCTS": {
      const configItems =
        (config.items as
          { productId?: number; showBadge?: boolean }[] | undefined) ?? [];
      // Products arrive on scroll — see LazySectionProducts. `configItems` is
      // still read here purely to skip a section an admin has left empty,
      // which is knowable from the shell alone.
      if (configItems.length === 0) return null;
      return (
        <LazySectionProducts
          key={section.id}
          sectionId={section.id}
          locale={localeParam}
          variant="topSelling"
          heading={section.heading ?? undefined}
        />
      );
    }

    // Same admin-curated `{productId, showBadge}[]` shape as TOP_SELLING_PRODUCTS,
    // but rendered as the compact strip carousel (ProductStripSection) instead
    // of the big-card grid — matches ghorerbazar.com's "Just For You" section.
    // No backing collection to derive a view-all target from, so it links to
    // the full catalog instead.
    case "JUST_FOR_YOU": {
      const configItems =
        (config.items as
          { productId?: number; showBadge?: boolean }[] | undefined) ?? [];
      if (configItems.length === 0) return null;
      return (
        <LazySectionProducts
          key={section.id}
          sectionId={section.id}
          locale={localeParam}
          variant="justForYou"
          heading={section.heading ?? "Just For You"}
          viewAllHref="/products"
          viewAllLabel="Shop All"
        />
      );
    }

    // Same admin-curated `{productId, showBadge}[]` shape as TOP_SELLING_PRODUCTS
    // and JUST_FOR_YOU, rendered in the gradient promo card that used to be
    // the hardcoded, bundle-driven "Exclusive Combo Deals" section — plain
    // hand-picked products now, no bundle/combo entity behind it.
    case "FEATURED_DEALS": {
      const configItems =
        (config.items as
          { productId?: number; showBadge?: boolean }[] | undefined) ?? [];
      if (configItems.length === 0) return null;
      return (
        <div className={`${WRAPPER_HALF} pt-10 md:pt-14`} key={section.id}>
          <LazySectionProducts
            sectionId={section.id}
            locale={localeParam}
            variant="featuredDeals"
            heading={section.heading ?? "Exclusive Deals"}
            viewAllHref="/products"
            viewAllLabel="View All"
          />
        </div>
      );
    }

    case "BLOG_TEASER": {
      const postIds = config.postIds as number[] | undefined;
      // When the admin explicitly picked posts (postIds), show all of them —
      // `config.limit` is a leftover default for the "latest N posts" mode
      // and shouldn't silently drop an explicitly-selected post.
      const limit =
        postIds?.length ?? (config.limit as number | undefined) ?? 8;
      const selected = (
        postIds?.length
          ? ctx.blogPosts.filter((p) => postIds.includes(p.id))
          : ctx.blogPosts
      ).slice(0, limit);
      if (selected.length === 0) return null;
      return (
        <div className={`${WRAPPER_HALF} py-9`} key={section.id}>
          <SectionHeading className="mb-10">
            {section.heading ?? "আমাদের ব্লগ"}
          </SectionHeading>
          <BlogCardGrid
            posts={selected.map((post) => toBlogCardData(post))}
            viewAllHref="/blog"
            viewAllLabel="View All"
            linkComponent={AppLink}
          />
        </div>
      );
    }

    case "CERTIFICATION_ROW": {
      const rawItems = config.items as
        { imageUrl?: string; label?: string }[] | undefined;
      const items = rawItems?.map((item) => ({
        imageUrl: toDisplayImageUrl(item.imageUrl, IMG.card),
        label: item.label,
      }));
      return (
        <div className={`${WRAPPER_HALF} py-9`} key={section.id}>
          <SectionHeading>
            {section.heading ?? "Our Certification"}
          </SectionHeading>
          <CertificationRow items={items} />
        </div>
      );
    }

    case "TESTIMONIAL_BENTO": {
      const rawReviews = config.reviews as
        | {
            quote: string;
            name: string;
            role?: string;
            avatarUrl?: string;
            rating?: number;
          }[]
        | undefined;
      const reviews = rawReviews?.map((r) => ({
        ...r,
        avatarUrl: toDisplayImageUrl(r.avatarUrl, IMG.icon),
      }));
      if (!reviews || reviews.length === 0) return null;
      return (
        <div className={`${WRAPPER_HALF} py-9`} key={section.id}>
          <SectionHeading>
            {section.heading ?? "500+ Happy Clients"}
          </SectionHeading>
          <TestimonialsBento reviews={reviews} />
        </div>
      );
    }

    case "CIRCLE_BADGE_BAR": {
      const items = config.items as
        { imageUrl?: string; label: string }[] | undefined;
      if (!items || items.length === 0) return null;
      return (
        <div className={WRAPPER} key={section.id}>
          <CircleBadgeBar items={items} />
        </div>
      );
    }

    case "AD_BANNER": {
      const images = config.images as
        { imageUrl: string; linkUrl?: string }[] | undefined;
      if (!images || images.length === 0) return null;
      return (
        <div className={`${WRAPPER_HALF} py-5`} key={section.id}>
          <AdBannerSection images={images} linkComponent={AppLink} />
        </div>
      );
    }

    // No longer tabbed — a single-collection product strip matching
    // amader-home-top.html's "Amader Modhu — Natural Honey" design (dropped
    // the pill-tab switcher + promo tile; resolves via the same
    // collectionId FK as PRODUCT_COLLECTION now instead of config.tabs).
    case "TABBED_COLLECTION_CAROUSEL": {
      if (!section.collection) return null;
      return (
        <LazySectionProducts
          key={section.id}
          sectionId={section.id}
          locale={localeParam}
          variant="justForYou"
          heading={section.heading ?? section.collection.name}
          viewAllHref={`/collections/${section.collection.slug}`}
          viewAllLabel="Shop All"
        />
      );
    }

    default:
      return null;
  }
}

// No longer a HomepageSection type (fixed position now, own admin page under
// Marketing → Promo Videos) — rendered from its own fetch below, spliced
// into the section list at a fixed index rather than sorted in by sortOrder.
function renderPromoVideos(videos: PublicPromoVideo[]): ReactNode {
  if (videos.length === 0) return null;
  const items = videos.map((v) => ({
    source: v.source,
    url: v.url,
    // Rendered as a raw <img> in a 377/650 reel tile, so it never reaches the
    // next/image loader — route it through the CDN here or the browser gets
    // the full-size upload.
    thumbnailUrl: toDisplayImageUrl(v.thumbnailUrl, IMG.card),
  }));
  const products = videos.map((v) =>
    v.product ? toPromoVideoProductData(v.product) : null,
  );
  return (
    <div className={WRAPPER_HALF} key="promo-videos">
      <PromoVideoSectionClient items={items} products={products} />
      {videos
        .flatMap((v) => v.structuredData)
        .map((item, i) => (
          <script
            key={i}
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(item) }}
          />
        ))}
    </div>
  );
}

export default async function Home({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  setRequestLocale(locale);
  const localeParam = toApiLocale(locale);

  // tagsRes is awaited on its own (not folded into the Promise.all below) so
  // the tag-dependent firstTagProducts request can fire as soon as it
  // resolves, instead of sitting behind the other 3 unrelated calls first —
  // that used to make this a serial chain for no reason, since
  // sections/categories/blog don't depend on tags at all.
  const tagsRes = await safeGet("/api/v1/tags", {
    params: { query: { locale: localeParam, pageSize: 6 } },
  });
  const tags = (tagsRes.data?.items ??
    []) as components["schemas"]["PublicTagDto"][];
  const firstTag = tags[0];
  const firstTagProductsPromise = firstTag
    ? safeGet("/api/v1/products", {
        params: {
          query: { locale: localeParam, tagIds: [firstTag.id], pageSize: 8 },
        },
      })
    : Promise.resolve({ data: undefined });

  const [
    sectionsRes,
    categoriesRes,
    blogRes,
    promoVideosRes,
    firstTagProductsRes,
  ] = await Promise.all([
    safeGet("/api/v1/homepage-sections", {
      // Shells only — each product row fetches its own products on scroll.
      params: { query: { locale: localeParam, withProducts: "false" } },
    }),
    safeGet("/api/v1/categories", {
      params: { query: { locale: localeParam, pageSize: 10 } },
    }),
    safeGet("/api/v1/blog-posts", {
      params: { query: { locale: localeParam, pageSize: 8 } },
    }),
    safeGet("/api/v1/promo-videos", {
      params: { query: { locale: localeParam } },
    }),
    firstTagProductsPromise,
  ]);

  const sections = (sectionsRes.data ?? []) as unknown as HomepageSection[];
  const categories = (categoriesRes.data?.items ??
    []) as components["schemas"]["PublicCategoryDto"][];
  const blogPosts = (blogRes.data?.items ??
    []) as components["schemas"]["PublicBlogPostSummaryDto"][];
  const promoVideos = (promoVideosRes.data ??
    []) as unknown as PublicPromoVideo[];
  const firstTagProducts = firstTagProductsRes.data?.items ?? [];

  // Promo Videos has a fixed homepage position (no longer a reorderable
  // HomepageSection) — kept at the same visual slot it occupied before the
  // switch: the 5th section on the page (previously sortOrder 4).
  const PROMO_VIDEOS_SLOT = 4;
  const beforePromoVideos = sections.slice(0, PROMO_VIDEOS_SLOT);
  const afterPromoVideos = sections.slice(PROMO_VIDEOS_SLOT);

  return (
    <main className="flex-1">
      {beforePromoVideos.map((section) => (
        <Fragment key={section.id}>
          {renderSection(section, { categories, blogPosts, locale: localeParam })}
        </Fragment>
      ))}
      {renderPromoVideos(promoVideos)}
      {afterPromoVideos.map((section) => (
        <Fragment key={section.id}>
          {renderSection(section, { categories, blogPosts, locale: localeParam })}
        </Fragment>
      ))}

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

      <div className={`${WRAPPER} py-9`}>
        <NewsletterBanner />
      </div>
    </main>
  );
}
