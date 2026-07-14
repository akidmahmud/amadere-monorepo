import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import * as Joi from 'joi';
import * as path from 'node:path';
import { PrismaModule } from './common/prisma/prisma.module';
import { CoreAuthModule } from './common/auth/core-auth.module';
import { AuditLogModule } from './common/audit-log/audit-log.module';
import { HealthModule } from './health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { RbacModule } from './modules/rbac/rbac.module';
import { AdminUsersModule } from './modules/admin-users/admin-users.module';
import { MediaModule } from './modules/media/media.module';
import { BrandsModule } from './modules/brands/brands.module';
import { CategoriesModule } from './modules/categories/categories.module';
import { TagsModule } from './modules/tags/tags.module';
import { AttributesModule } from './modules/attributes/attributes.module';
import { ProductsModule } from './modules/products/products.module';
import { ProductBundlesModule } from './modules/product-bundles/product-bundles.module';
import { SearchModule } from './modules/search/search.module';
import { DiscountsModule } from './modules/discounts/discounts.module';
import { GiftVouchersModule } from './modules/gift-vouchers/gift-vouchers.module';
import { CartModule } from './modules/cart/cart.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { OrdersModule } from './modules/orders/orders.module';
import { CourierModule } from './modules/courier/courier.module';
import { CustomersModule } from './modules/customers/customers.module';
import { ReviewsModule } from './modules/reviews/reviews.module';
import { NewsletterModule } from './modules/newsletter/newsletter.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';
import { BlogCategoriesModule } from './modules/blog-categories/blog-categories.module';
import { BlogTagsModule } from './modules/blog-tags/blog-tags.module';
import { BlogPostsModule } from './modules/blog-posts/blog-posts.module';
import { PagesModule } from './modules/pages/pages.module';
import { SeoModule } from './modules/seo/seo.module';
import { RedirectsModule } from './modules/redirects/redirects.module';
import { SitemapModule } from './modules/sitemap/sitemap.module';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { SettingsModule } from './modules/settings/settings.module';
import { MenusModule } from './modules/menus/menus.module';
import { CollectionsModule } from './modules/collections/collections.module';
import { HomepageSectionsModule } from './modules/homepage-sections/homepage-sections.module';
import { NetProfitModule } from './modules/net-profit/net-profit.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: path.resolve(__dirname, '../../../.env'),
      validationSchema: Joi.object({
        NODE_ENV: Joi.string()
          .valid('development', 'production', 'test')
          .default('development'),
        PORT: Joi.number().port().default(3000),
        DATABASE_URL: Joi.string().uri().required(),
        ADMIN_JWT_ACCESS_SECRET: Joi.string().min(16).required(),
        ADMIN_JWT_REFRESH_SECRET: Joi.string().min(16).required(),
        CUSTOMER_JWT_ACCESS_SECRET: Joi.string().min(16).required(),
        CUSTOMER_JWT_REFRESH_SECRET: Joi.string().min(16).required(),
        SUPER_ADMIN_EMAIL: Joi.string().email().required(),
        SUPER_ADMIN_PASSWORD: Joi.string().min(8).required(),
        // Optional: R2 credentials arrive later (AGENTS.md §6), app must boot
        // without them — only an actual media upload attempt needs these.
        R2_ACCOUNT_ID: Joi.string().optional(),
        R2_ACCESS_KEY_ID: Joi.string().optional(),
        R2_SECRET_ACCESS_KEY: Joi.string().optional(),
        R2_BUCKET: Joi.string().optional(),
        R2_PUBLIC_BASE_URL: Joi.string().optional(),
        // Optional: Steadfast credentials arrive later — app must boot
        // without them, only a dispatch attempt needs these.
        STEADFAST_API_KEY: Joi.string().optional(),
        STEADFAST_SECRET_KEY: Joi.string().optional(),
        // Optional: absolute origin for sitemap/canonical/structured-data
        // URLs (e.g. https://amadere.com). Without it, URLs are relative —
        // fine for local dev, must be set before this hits production.
        STOREFRONT_BASE_URL: Joi.string().optional(),
        // Optional: server-side analytics forwarding (AGENTS.md §6) — app
        // must boot without any of these, each provider just no-ops.
        GA4_MEASUREMENT_ID: Joi.string().optional(),
        GA4_API_SECRET: Joi.string().optional(),
        META_PIXEL_ID: Joi.string().optional(),
        META_ACCESS_TOKEN: Joi.string().optional(),
        TIKTOK_PIXEL_CODE: Joi.string().optional(),
        TIKTOK_ACCESS_TOKEN: Joi.string().optional(),
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60000, limit: 120 }]),
    EventEmitterModule.forRoot(),
    ScheduleModule.forRoot(),
    PrismaModule,
    CoreAuthModule,
    AuditLogModule,
    HealthModule,
    AuthModule,
    RbacModule,
    AdminUsersModule,
    MediaModule,
    BrandsModule,
    CategoriesModule,
    TagsModule,
    AttributesModule,
    ProductsModule,
    ProductBundlesModule,
    SearchModule,
    DiscountsModule,
    GiftVouchersModule,
    CartModule,
    PaymentsModule,
    OrdersModule,
    CourierModule,
    CustomersModule,
    ReviewsModule,
    NewsletterModule,
    DashboardModule,
    BlogCategoriesModule,
    BlogTagsModule,
    BlogPostsModule,
    PagesModule,
    SeoModule,
    RedirectsModule,
    SitemapModule,
    AnalyticsModule,
    SettingsModule,
    MenusModule,
    CollectionsModule,
    HomepageSectionsModule,
    NetProfitModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class AppModule {}
