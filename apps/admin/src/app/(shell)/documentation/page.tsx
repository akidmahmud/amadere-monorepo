"use client";

import { useState } from "react";
import { Card, Icon, Tabs } from "@amader/admin-ui";

type Lang = "EN" | "BN";

interface DocEntry {
  key: string;
  icon: string;
  en: { title: string; body: string };
  bn: { title: string; body: string };
}

interface DocSection {
  key: string;
  en: string;
  bn: string;
  entries: DocEntry[];
}

// Static, hand-written reference content — mirrors adminNav's own grouping
// 1:1 (lib/nav-config.tsx) so this page reads as a map of the whole sidebar,
// not a separate taxonomy an admin has to re-learn. Deliberately not
// database-backed: editing this requires a code change, same as any other
// static copy in the app — the tradeoff accepted per explicit request
// instead of building a full CRUD module (schema + backend + admin UI) for
// what is, for now, reference text an admin reads rather than edits.
const SECTIONS: DocSection[] = [
  {
    key: "orders",
    en: "Orders & Fulfillment",
    bn: "অর্ডার ও ডেলিভারি",
    entries: [
      {
        key: "new-order",
        icon: "add_shopping_cart",
        en: {
          title: "New Order",
          body: "Manually create an order on a customer's behalf — phone orders, Facebook/WhatsApp orders, or anything that didn't come through the storefront. Pick products, set quantities/price overrides, enter the shipping address, and choose a payment method (COD or manual) just like a real checkout.",
        },
        bn: {
          title: "নতুন অর্ডার",
          body: "কাস্টমারের পক্ষে নিজে হাতে অর্ডার তৈরি করুন — ফোনে, ফেসবুকে বা হোয়াটসঅ্যাপে আসা অর্ডারের জন্য, যেগুলো সরাসরি ওয়েবসাইট থেকে আসেনি। পণ্য বেছে নিন, পরিমাণ/দাম ঠিক করুন, ডেলিভারি ঠিকানা লিখুন এবং পেমেন্ট মেথড (ক্যাশ অন ডেলিভারি বা ম্যানুয়াল) বেছে নিন — একদম সাধারণ চেকআউটের মতোই।",
        },
      },
      {
        key: "shipments",
        icon: "local_shipping",
        en: {
          title: "Shipments",
          body: "The live dispatch queue — see every order waiting to ship, run a courier fraud check on the customer's phone number before dispatching, and send the order to the courier (Steadfast) with one click. Has its own Deleted Orders tab to restore an order removed by mistake.",
        },
        bn: {
          title: "শিপমেন্ট",
          body: "ডেলিভারির জন্য অপেক্ষারত সব অর্ডারের লাইভ তালিকা — কুরিয়ারে পাঠানোর আগে কাস্টমারের ফোন নম্বরে ফ্রড চেক করুন এবং এক ক্লিকে অর্ডারটি কুরিয়ারে (স্টেডফাস্ট) পাঠান। ভুলবশত ডিলিট হওয়া অর্ডার ফিরিয়ে আনার জন্য এখানে আলাদা 'Deleted Orders' ট্যাব আছে।",
        },
      },
    ],
  },
  {
    key: "products",
    en: "Product Management",
    bn: "পণ্য ব্যবস্থাপনা",
    entries: [
      {
        key: "products",
        icon: "inventory_2",
        en: {
          title: "Products",
          body: "Full product catalog — create/edit products with photos, pricing, stock, SEO, and variants (size/weight/color combinations, each with its own price and stock). Every product needs both an English and Bangla name/description.",
        },
        bn: {
          title: "পণ্য",
          body: "সম্পূর্ণ পণ্যের তালিকা — ছবি, দাম, স্টক, SEO এবং ভ্যারিয়েন্ট (সাইজ/ওজন/রঙ অনুযায়ী আলাদা দাম ও স্টক) দিয়ে পণ্য তৈরি/এডিট করুন। প্রতিটি পণ্যের ইংরেজি এবং বাংলা দুই ভাষাতেই নাম ও বিবরণ থাকা প্রয়োজন।",
        },
      },
      {
        key: "products-trash",
        icon: "delete",
        en: {
          title: "Deleted Products",
          body: "Soft-deleted products live here, not gone forever — restore one back into the live catalog any time, or see what's been removed and when.",
        },
        bn: {
          title: "ডিলিট হওয়া পণ্য",
          body: "ডিলিট করা পণ্য এখানে সংরক্ষিত থাকে, একেবারে মুছে যায় না — চাইলে যেকোনো সময় আবার লাইভ ক্যাটালগে ফিরিয়ে আনতে পারবেন।",
        },
      },
      {
        key: "collections",
        icon: "collections_bookmark",
        en: {
          title: "Collections",
          body: "Hand-curated product groups (e.g. \"Ramadan Specials\", \"New Arrivals\") that can be featured on the homepage or linked from the nav menu — distinct from Categories, which are the product's actual catalog classification.",
        },
        bn: {
          title: "কালেকশন",
          body: "হাতে বেছে তৈরি করা পণ্যের গ্রুপ (যেমন \"রমজান স্পেশাল\", \"নতুন পণ্য\") যা হোমপেজে বা মেনুতে দেখানো যায় — এটি ক্যাটাগরি থেকে আলাদা, যা পণ্যের প্রকৃত শ্রেণিবিন্যাস।",
        },
      },
      {
        key: "brands",
        icon: "storefront",
        en: {
          title: "Brands",
          body: "The brand list a product can be tagged with (mainly relevant if the store ever carries more than one brand's products) — name, logo, and description.",
        },
        bn: {
          title: "ব্র্যান্ড",
          body: "পণ্যে যুক্ত করার জন্য ব্র্যান্ডের তালিকা (দোকানে একাধিক ব্র্যান্ডের পণ্য থাকলে বিশেষভাবে প্রাসঙ্গিক) — নাম, লোগো এবং বিবরণসহ।",
        },
      },
      {
        key: "categories",
        icon: "category",
        en: {
          title: "Categories",
          body: "The catalog's tree structure (e.g. Food > Spices > Whole Spices) — supports nested sub-categories. This is what drives category-based filtering and browsing on the storefront.",
        },
        bn: {
          title: "ক্যাটাগরি",
          body: "ক্যাটালগের শ্রেণিবিন্যাস কাঠামো (যেমন খাবার > মসলা > গোটা মসলা) — সাব-ক্যাটাগরিও যুক্ত করা যায়। ওয়েবসাইটে ক্যাটাগরি অনুযায়ী পণ্য খোঁজা এই কাঠামোর উপরই নির্ভর করে।",
        },
      },
      {
        key: "tags",
        icon: "sell",
        en: {
          title: "Tags",
          body: "Free-form labels attached to products for search and filtering (e.g. \"organic\", \"gluten-free\") — lighter-weight than Categories, a product can carry several.",
        },
        bn: {
          title: "ট্যাগ",
          body: "পণ্য খোঁজা ও ফিল্টার করার জন্য স্বাধীনভাবে যুক্ত করা লেবেল (যেমন \"অর্গানিক\", \"গ্লুটেন-ফ্রি\") — ক্যাটাগরির চেয়ে হালকা, একটি পণ্যে একাধিক ট্যাগ থাকতে পারে।",
        },
      },
      {
        key: "attributes",
        icon: "tune",
        en: {
          title: "Attributes",
          body: "The building blocks behind product variants — define an attribute (e.g. \"Size\") and its possible values (e.g. \"250g\", \"500g\", \"1kg\"); products then combine attribute values to build their variant list.",
        },
        bn: {
          title: "অ্যাট্রিবিউট",
          body: "পণ্যের ভ্যারিয়েন্টের মূল উপাদান — একটি অ্যাট্রিবিউট (যেমন \"সাইজ\") এবং তার সম্ভাব্য মান (যেমন \"২৫০ গ্রাম\", \"৫০০ গ্রাম\", \"১ কেজি\") তৈরি করুন; পণ্য তৈরির সময় এই মানগুলো মিলিয়ে ভ্যারিয়েন্ট বানানো হয়।",
        },
      },
    ],
  },
  {
    key: "marketing",
    en: "Marketing",
    bn: "মার্কেটিং",
    entries: [
      {
        key: "newsletter-campaigns",
        icon: "campaign",
        en: {
          title: "Newsletter Campaigns",
          body: "Compose and send one-off email campaigns to a segment of subscribers — promotions, announcements, or updates.",
        },
        bn: {
          title: "নিউজলেটার ক্যাম্পেইন",
          body: "সাবস্ক্রাইবারদের একটি নির্দিষ্ট গ্রুপকে একবারের ইমেইল ক্যাম্পেইন পাঠান — প্রোমোশন, ঘোষণা বা আপডেটের জন্য।",
        },
      },
      {
        key: "newsletter-templates",
        icon: "dashboard_customize",
        en: {
          title: "Newsletter Templates",
          body: "Reusable email layouts/designs — build a template once, reuse it across multiple campaigns instead of designing every email from scratch.",
        },
        bn: {
          title: "নিউজলেটার টেমপ্লেট",
          body: "পুনরায় ব্যবহারযোগ্য ইমেইল লেআউট/ডিজাইন — একবার টেমপ্লেট তৈরি করে একাধিক ক্যাম্পেইনে ব্যবহার করুন, প্রতিবার নতুন করে ডিজাইন করতে হবে না।",
        },
      },
      {
        key: "newsletter-segments",
        icon: "groups",
        en: {
          title: "Newsletter Segments",
          body: "Group subscribers by criteria (e.g. past purchase behavior, tags) so a campaign can target a specific slice of the list instead of everyone.",
        },
        bn: {
          title: "নিউজলেটার সেগমেন্ট",
          body: "নির্দিষ্ট শর্ত অনুযায়ী (যেমন আগের কেনাকাটার ধরন, ট্যাগ) সাবস্ক্রাইবারদের গ্রুপ করুন, যাতে ক্যাম্পেইন সবাইকে না পাঠিয়ে নির্দিষ্ট গ্রুপকে টার্গেট করা যায়।",
        },
      },
      {
        key: "homepage-sections",
        icon: "view_agenda",
        en: {
          title: "Homepage Sections",
          body: "Build the storefront's homepage, section by section — hero banners, featured product rows, blog teasers, testimonials, and more. Drag to reorder; each section type has its own config form (images, links, hand-picked products).",
        },
        bn: {
          title: "হোমপেজ সেকশন",
          body: "ওয়েবসাইটের হোমপেজ ধাপে ধাপে সাজান — হিরো ব্যানার, ফিচারড পণ্যের সারি, ব্লগ প্রিভিউ, টেস্টিমোনিয়াল ইত্যাদি। ড্র্যাগ করে ক্রম পরিবর্তন করা যায়; প্রতিটি সেকশনের নিজস্ব সেটিংস ফর্ম আছে (ছবি, লিংক, বেছে নেওয়া পণ্য)।",
        },
      },
      {
        key: "promo-videos",
        icon: "smart_display",
        en: {
          title: "Promo Videos",
          body: "Short shoppable video cards (YouTube/TikTok/Instagram/uploaded clips) shown on the homepage — attach a product to a video so a customer can add it to cart right from the video popup.",
        },
        bn: {
          title: "প্রোমো ভিডিও",
          body: "হোমপেজে দেখানো ছোট শপযোগ্য ভিডিও কার্ড (ইউটিউব/টিকটক/ইনস্টাগ্রাম/আপলোড করা ভিডিও) — ভিডিওর সাথে একটি পণ্য যুক্ত করুন যাতে কাস্টমার ভিডিও দেখেই সরাসরি কার্টে যোগ করতে পারে।",
        },
      },
      {
        key: "discounts",
        icon: "local_offer",
        en: {
          title: "Discounts",
          body: "Coupon codes (customer types a code at checkout) and automatic promotions (apply themselves, no code needed) — percentage off, fixed amount off, or free shipping, with date windows and usage limits.",
        },
        bn: {
          title: "ডিসকাউন্ট",
          body: "কুপন কোড (চেকআউটে কাস্টমার কোড টাইপ করে) এবং অটোমেটিক প্রমোশন (কোড ছাড়াই নিজে থেকে প্রযোজ্য হয়) — শতকরা ছাড়, নির্দিষ্ট টাকা ছাড় বা ফ্রি শিপিং, তারিখ ও ব্যবহারের সীমাসহ।",
        },
      },
      {
        key: "gift-vouchers",
        icon: "card_giftcard",
        en: {
          title: "Gift Vouchers",
          body: "Create prepaid gift voucher codes with a starting balance — a customer redeems the code at checkout and the balance is deducted from their order total. Deactivate a voucher any time to stop it being used.",
        },
        bn: {
          title: "গিফট ভাউচার",
          body: "একটি নির্দিষ্ট ব্যালেন্স দিয়ে প্রিপেইড গিফট ভাউচার কোড তৈরি করুন — কাস্টমার চেকআউটে কোড ব্যবহার করলে সেই ব্যালেন্স থেকে টাকা কেটে নেওয়া হয়। যেকোনো সময় ভাউচার নিষ্ক্রিয় করে দেওয়া যায়।",
        },
      },
      {
        key: "whatsapp",
        icon: "chat",
        en: {
          title: "WhatsApp",
          body: "Configure the floating WhatsApp contact button shown on the storefront — the number it messages and whether it's enabled.",
        },
        bn: {
          title: "হোয়াটসঅ্যাপ",
          body: "ওয়েবসাইটে দেখানো ভাসমান হোয়াটসঅ্যাপ বাটনের সেটিংস — কোন নম্বরে মেসেজ যাবে এবং এটি চালু থাকবে কিনা।",
        },
      },
      {
        key: "reviews",
        icon: "star",
        en: {
          title: "Reviews",
          body: "Moderate customer product reviews — only customers who actually bought the product can leave one. Approve/reject pending reviews and reply publicly to any of them.",
        },
        bn: {
          title: "রিভিউ",
          body: "কাস্টমারের পণ্য রিভিউ যাচাই করুন — শুধুমাত্র যেসব কাস্টমার সত্যিই পণ্যটি কিনেছেন তারাই রিভিউ দিতে পারেন। অপেক্ষমাণ রিভিউ অনুমোদন/বাতিল করুন এবং প্রকাশ্যে রিপ্লাই দিন।",
        },
      },
    ],
  },
  {
    key: "net-profit",
    en: "Net Profit",
    bn: "নেট প্রফিট",
    entries: [
      {
        key: "net-profit-overview",
        icon: "trending_up",
        en: {
          title: "Overview",
          body: "The Net Profit dashboard's home page — revenue, expenses, and profit at a glance for a selected date range.",
        },
        bn: {
          title: "ওভারভিউ",
          body: "নেট প্রফিট ড্যাশবোর্ডের প্রধান পেজ — নির্বাচিত সময়ের জন্য আয়, খরচ এবং লাভ এক নজরে।",
        },
      },
      {
        key: "net-profit-fraud",
        icon: "gpp_maybe",
        en: {
          title: "Courier Fraud Detection",
          body: "Checks a phone number's delivery history with the courier before an order ships — flags customers with a poor delivery success rate so risky COD orders can be caught early.",
        },
        bn: {
          title: "কুরিয়ার ফ্রড ডিটেকশন",
          body: "অর্ডার পাঠানোর আগে কুরিয়ারের কাছে ফোন নম্বরের ডেলিভারি ইতিহাস যাচাই করে — যেসব কাস্টমারের ডেলিভারি সাকসেস রেট কম, তাদের চিহ্নিত করে ঝুঁকিপূর্ণ COD অর্ডার আগেভাগেই ধরা যায়।",
        },
      },
      {
        key: "net-profit-orders",
        icon: "list_alt",
        en: {
          title: "Order Manager",
          body: "The full order list with deep filtering — status, date range, payment method, search by phone/order number. Bulk actions (delete/restore) and the source of truth this admin uses for order-level reporting.",
        },
        bn: {
          title: "অর্ডার ম্যানেজার",
          body: "সম্পূর্ণ অর্ডার তালিকা বিস্তারিত ফিল্টারসহ — স্ট্যাটাস, তারিখ, পেমেন্ট মেথড, ফোন/অর্ডার নম্বর দিয়ে খোঁজা। একসাথে একাধিক অর্ডার ডিলিট/রিস্টোর করা যায়।",
        },
      },
      {
        key: "net-profit-blocker",
        icon: "block",
        en: {
          title: "Order Blocker",
          body: "Automated rules that can hold or block suspicious orders at checkout (e.g. duplicate orders, daily order limits, VPN/proxy detection) — each rule is individually toggle-able with its own message shown to the customer.",
        },
        bn: {
          title: "অর্ডার ব্লকার",
          body: "চেকআউটে সন্দেহজনক অর্ডার আটকে রাখা বা ব্লক করার অটোমেটিক নিয়ম (যেমন একই অর্ডার বারবার, দৈনিক অর্ডার সীমা, VPN/প্রক্সি সনাক্তকরণ) — প্রতিটি নিয়ম আলাদাভাবে চালু/বন্ধ করা যায়, নিজস্ব মেসেজসহ যা কাস্টমারকে দেখানো হয়।",
        },
      },
      {
        key: "net-profit-sms",
        icon: "sms",
        en: {
          title: "SMS",
          body: "SMS gateway settings and delivery status — configure which order-status changes trigger an automatic SMS to the customer (e.g. Confirmed, Completed).",
        },
        bn: {
          title: "এসএমএস",
          body: "এসএমএস গেটওয়ে সেটিংস এবং ডেলিভারি স্ট্যাটাস — অর্ডারের কোন স্ট্যাটাস পরিবর্তনে কাস্টমারকে অটোমেটিক এসএমএস যাবে তা নির্ধারণ করুন (যেমন Confirmed, Completed)।",
        },
      },
      {
        key: "net-profit-payments",
        icon: "payments",
        en: {
          title: "Payments",
          body: "Payment gateway configuration (bKash, Nagad, SSLCommerz, bank transfer) and a log of processed/refunded payments.",
        },
        bn: {
          title: "পেমেন্ট",
          body: "পেমেন্ট গেটওয়ে সেটিংস (বিকাশ, নগদ, SSLCommerz, ব্যাংক ট্রান্সফার) এবং প্রসেস/রিফান্ড হওয়া পেমেন্টের লগ।",
        },
      },
      {
        key: "net-profit-recovery",
        icon: "shopping_cart_checkout",
        en: {
          title: "Recovery",
          body: "Abandoned-cart recovery — see carts customers left without completing checkout, and the automated reminder emails/messages sent to win them back.",
        },
        bn: {
          title: "রিকভারি",
          body: "চেকআউট শেষ না করে ফেলে রাখা কার্ট — কোন কাস্টমার কার্ট ফেলে গেছেন এবং তাদের ফিরিয়ে আনতে অটোমেটিক পাঠানো রিমাইন্ডার ইমেইল/মেসেজ দেখুন।",
        },
      },
      {
        key: "net-profit-reports",
        icon: "bar_chart",
        en: {
          title: "Sales Report",
          body: "Sales figures broken down by product, category, or time period — exportable, for spotting what's actually selling.",
        },
        bn: {
          title: "সেলস রিপোর্ট",
          body: "পণ্য, ক্যাটাগরি বা সময় অনুযায়ী বিক্রির পরিসংখ্যান — এক্সপোর্ট করা যায়, কোন পণ্য আসলে ভালো বিক্রি হচ্ছে তা বোঝার জন্য।",
        },
      },
      {
        key: "net-profit-accounts",
        icon: "account_balance",
        en: {
          title: "Accounts",
          body: "Bookkeeping — record business expenses, track dues owed to/from customers and suppliers, VAT summary, and a cash-flow view. Also where VAT rate and COD fee percentage are configured.",
        },
        bn: {
          title: "অ্যাকাউন্টস",
          body: "হিসাবরক্ষণ — ব্যবসায়িক খরচ লিপিবদ্ধ করুন, কাস্টমার ও সাপ্লায়ারের কাছে/থেকে পাওনা ট্র্যাক করুন, VAT সামারি এবং ক্যাশ-ফ্লো দেখুন। এখানেই VAT হার এবং COD ফি শতাংশ নির্ধারণ করা হয়।",
        },
      },
    ],
  },
  {
    key: "customers",
    en: "Customers",
    bn: "কাস্টমার",
    entries: [
      {
        key: "customers-list",
        icon: "people",
        en: {
          title: "All Customers",
          body: "The full customer list — profile, order history, and saved addresses for each registered customer.",
        },
        bn: {
          title: "সব কাস্টমার",
          body: "সম্পূর্ণ কাস্টমার তালিকা — প্রতিটি নিবন্ধিত কাস্টমারের প্রোফাইল, অর্ডার ইতিহাস এবং সংরক্ষিত ঠিকানা।",
        },
      },
      {
        key: "customers-tiers",
        icon: "military_tech",
        en: {
          title: "Tiers",
          body: "Loyalty tiers based on order history (e.g. Bronze/Silver/Gold) — define the thresholds; customers move up automatically as they order more.",
        },
        bn: {
          title: "টিয়ার",
          body: "অর্ডার ইতিহাসের উপর ভিত্তি করে লয়ালটি টিয়ার (যেমন ব্রোঞ্জ/সিলভার/গোল্ড) — সীমা নির্ধারণ করুন; কাস্টমার বেশি অর্ডার করলে স্বয়ংক্রিয়ভাবে উপরের টিয়ারে উঠে যায়।",
        },
      },
    ],
  },
  {
    key: "content",
    en: "Content",
    bn: "কন্টেন্ট",
    entries: [
      {
        key: "blog-posts",
        icon: "article",
        en: {
          title: "Blog Posts",
          body: "Write and publish blog articles — draft, submit for review, and publish workflow, with per-post SEO score, FAQ section, and auto-generated table of contents.",
        },
        bn: {
          title: "ব্লগ পোস্ট",
          body: "ব্লগ আর্টিকেল লিখুন ও প্রকাশ করুন — ড্রাফট, রিভিউর জন্য জমা এবং প্রকাশ করার ধাপ, প্রতিটি পোস্টের নিজস্ব SEO স্কোর, FAQ সেকশন এবং অটোমেটিক সূচিপত্রসহ।",
        },
      },
      {
        key: "blog-posts-trash",
        icon: "delete",
        en: {
          title: "Deleted Blog Posts",
          body: "Soft-deleted posts — restore one back to draft/published any time.",
        },
        bn: {
          title: "ডিলিট হওয়া ব্লগ পোস্ট",
          body: "ডিলিট করা পোস্ট — যেকোনো সময় আবার ড্রাফট/প্রকাশিত অবস্থায় ফিরিয়ে আনা যায়।",
        },
      },
      {
        key: "blog-categories",
        icon: "topic",
        en: { title: "Blog Categories", body: "Categories for organizing blog posts — separate from the product Categories." },
        bn: { title: "ব্লগ ক্যাটাগরি", body: "ব্লগ পোস্ট গোছানোর জন্য ক্যাটাগরি — পণ্যের ক্যাটাগরি থেকে সম্পূর্ণ আলাদা।" },
      },
      {
        key: "blog-tags",
        icon: "label",
        en: { title: "Blog Tags", body: "Free-form labels for blog posts, used for related-article suggestions and filtering." },
        bn: { title: "ব্লগ ট্যাগ", body: "ব্লগ পোস্টের জন্য স্বাধীন লেবেল — সম্পর্কিত আর্টিকেল সাজেশন ও ফিল্টারিংয়ে ব্যবহৃত হয়।" },
      },
      {
        key: "pages",
        icon: "description",
        en: {
          title: "Pages",
          body: "Static content pages — About Us, Terms & Conditions, Privacy Policy, Return Policy, or any other fixed page with its own URL slug.",
        },
        bn: {
          title: "পেজ",
          body: "স্থির কন্টেন্ট পেজ — আমাদের সম্পর্কে, শর্তাবলী, গোপনীয়তা নীতি, রিটার্ন পলিসি — বা নিজস্ব URL সহ যেকোনো স্থায়ী পেজ।",
        },
      },
      {
        key: "menu-items",
        icon: "menu",
        en: { title: "Menu Items", body: "The storefront's navigation menu — add, reorder, or link menu entries to categories, collections, or pages." },
        bn: { title: "মেনু আইটেম", body: "ওয়েবসাইটের নেভিগেশন মেনু — মেনু আইটেম যোগ করুন, ক্রম পরিবর্তন করুন, বা ক্যাটাগরি/কালেকশন/পেজের সাথে লিংক করুন।" },
      },
      {
        key: "announcements",
        icon: "campaign",
        en: {
          title: "Announcements",
          body: "The scrolling announcement bar at the very top of the storefront (e.g. \"Free delivery this week\") — one or more rotating messages.",
        },
        bn: {
          title: "ঘোষণা",
          body: "ওয়েবসাইটের একদম উপরে স্ক্রলিং ঘোষণা বার (যেমন \"এই সপ্তাহে ফ্রি ডেলিভারি\") — একাধিক পালাক্রমে দেখানো মেসেজ যুক্ত করা যায়।",
        },
      },
    ],
  },
  {
    key: "seo",
    en: "SEO",
    bn: "SEO",
    entries: [
      {
        key: "redirects",
        icon: "alt_route",
        en: {
          title: "Redirects",
          body: "301 redirect rules — send visitors (and search engines) from an old/broken URL to the correct current one instead of a 404 page.",
        },
        bn: {
          title: "রিডাইরেক্ট",
          body: "৩০১ রিডাইরেক্ট নিয়ম — ভিজিটর ও সার্চ ইঞ্জিনকে পুরনো/ভাঙা URL থেকে সঠিক বর্তমান URL-এ পাঠায়, 404 পেজের বদলে।",
        },
      },
      {
        key: "seo-meta",
        icon: "search",
        en: {
          title: "SEO Meta",
          body: "Override the meta title, description, and social-share preview for any product, category, blog post, or page — otherwise a sensible default is generated automatically.",
        },
        bn: {
          title: "SEO মেটা",
          body: "যেকোনো পণ্য, ক্যাটাগরি, ব্লগ পোস্ট বা পেজের মেটা টাইটেল, বিবরণ এবং সোশ্যাল-শেয়ার প্রিভিউ নিজের মতো সেট করুন — না করলে স্বয়ংক্রিয়ভাবে একটি যুক্তিসঙ্গত ডিফল্ট তৈরি হয়।",
        },
      },
      {
        key: "search-synonyms",
        icon: "sync_alt",
        en: {
          title: "Search Synonyms",
          body: "Teach the storefront search that different words mean the same product (e.g. \"ছাতু\"/\"Chatu\"/\"Sattu\") so a typo or an alternate spelling still finds it.",
        },
        bn: {
          title: "সার্চ সিনোনিম",
          body: "একই পণ্যের ভিন্ন নাম সার্চকে শেখান (যেমন \"ছাতু\"/\"Chatu\"/\"Sattu\") — যাতে ভিন্ন বানান বা টাইপো লিখলেও পণ্যটি খুঁজে পাওয়া যায়।",
        },
      },
    ],
  },
  {
    key: "insights",
    en: "Insights",
    bn: "ইনসাইটস",
    entries: [
      {
        key: "analytics",
        icon: "monitoring",
        en: { title: "Analytics", body: "Analytics/tracking configuration — GA4, Meta Pixel/CAPI, TikTok, Google Ads, Microsoft Clarity keys." },
        bn: { title: "অ্যানালিটিক্স", body: "অ্যানালিটিক্স/ট্র্যাকিং সেটিংস — GA4, Meta Pixel/CAPI, TikTok, Google Ads, Microsoft Clarity কী।" },
      },
      {
        key: "media",
        icon: "perm_media",
        en: {
          title: "Media Library",
          body: "Every image/video uploaded across the whole admin lives here — browse and reuse an existing upload anywhere an image picker appears, instead of re-uploading the same file.",
        },
        bn: {
          title: "মিডিয়া লাইব্রেরি",
          body: "অ্যাডমিনের সব জায়গায় আপলোড করা প্রতিটি ছবি/ভিডিও এখানে জমা থাকে — যেকোনো ইমেজ পিকারে আগের আপলোড করা ফাইল আবার ব্যবহার করুন, নতুন করে আপলোডের দরকার নেই।",
        },
      },
      {
        key: "newsletter",
        icon: "mail",
        en: { title: "Newsletter", body: "The raw subscriber list — everyone who signed up for the newsletter, with their subscribe date." },
        bn: { title: "নিউজলেটার", body: "মূল সাবস্ক্রাইবার তালিকা — যারা নিউজলেটারে সাইন আপ করেছেন, তাদের সাবস্ক্রাইবের তারিখসহ।" },
      },
    ],
  },
  {
    key: "admin",
    en: "Admin",
    bn: "অ্যাডমিন",
    entries: [
      {
        key: "staff",
        icon: "group",
        en: {
          title: "Staff",
          body: "Create staff/admin accounts and assign them one or more Roles. Only a Super Admin can create staff — there's no public signup for admin accounts.",
        },
        bn: {
          title: "স্টাফ",
          body: "স্টাফ/অ্যাডমিন অ্যাকাউন্ট তৈরি করুন এবং একটি বা একাধিক রোল দিন। শুধুমাত্র সুপার অ্যাডমিন স্টাফ তৈরি করতে পারেন — অ্যাডমিন অ্যাকাউন্টের জন্য কোনো পাবলিক সাইনআপ নেই।",
        },
      },
      {
        key: "roles",
        icon: "admin_panel_settings",
        en: {
          title: "Roles",
          body: "Define named roles (e.g. \"Order Manager\", \"Content Editor\") and pick exactly which permissions each role has — a staff account only gets to do what their assigned role(s) allow.",
        },
        bn: {
          title: "রোল",
          body: "নির্দিষ্ট নামের রোল তৈরি করুন (যেমন \"অর্ডার ম্যানেজার\", \"কন্টেন্ট এডিটর\") এবং প্রতিটি রোলের জন্য ঠিক কোন কোন অনুমতি থাকবে তা বেছে নিন — একজন স্টাফ শুধু তার রোলে দেওয়া কাজই করতে পারবে।",
        },
      },
      {
        key: "audit-log",
        icon: "history",
        en: {
          title: "Audit Log",
          body: "A read-only history of every write action any staff member has taken across the admin — who did what, and when. Useful for tracing down an unexpected change.",
        },
        bn: {
          title: "অডিট লগ",
          body: "অ্যাডমিনে যেকোনো স্টাফের করা প্রতিটি পরিবর্তনের রিড-অনলি ইতিহাস — কে, কখন, কী করেছে। কোনো অপ্রত্যাশিত পরিবর্তনের কারণ খুঁজে বের করতে কাজে লাগে।",
        },
      },
      {
        key: "settings",
        icon: "settings",
        en: {
          title: "Settings",
          body: "Site-wide configuration that doesn't belong to any one feature — store name/logo, currency, free-shipping threshold, and other global switches.",
        },
        bn: {
          title: "সেটিংস",
          body: "কোনো একটি নির্দিষ্ট ফিচারের সাথে যুক্ত নয় এমন সাইট-ওয়াইড সেটিংস — দোকানের নাম/লোগো, মুদ্রা, ফ্রি শিপিং সীমা এবং অন্যান্য গ্লোবাল সুইচ।",
        },
      },
    ],
  },
];

const LANG_OPTIONS = [
  { value: "EN", label: "English" },
  { value: "BN", label: "বাংলা" },
];

export default function DocumentationPage() {
  const [lang, setLang] = useState<Lang>("EN");

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">
          {lang === "EN"
            ? "A quick reference for what every section of this admin panel does."
            : "এই অ্যাডমিন প্যানেলের প্রতিটি সেকশন কী কাজ করে তার সংক্ষিপ্ত নির্দেশিকা।"}
        </p>
        <Tabs options={LANG_OPTIONS} value={lang} onChange={(v) => setLang(v as Lang)} variant="pill" />
      </div>

      <div className="mt-6 flex flex-col gap-8">
        {SECTIONS.map((section) => (
          <div key={section.key}>
            <h2 className="mb-3 font-ui text-base font-bold text-text">{lang === "EN" ? section.en : section.bn}</h2>
            <div className="grid grid-cols-1 gap-3.5 md:grid-cols-2 xl:grid-cols-3">
              {section.entries.map((entry) => {
                const copy = lang === "EN" ? entry.en : entry.bn;
                return (
                  <Card key={entry.key} className="flex flex-col gap-2.5">
                    <div className="flex items-center gap-2.5">
                      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-sm bg-brand-500/10 text-brand-500">
                        <Icon name={entry.icon} size={18} />
                      </span>
                      <h3 className="font-ui text-sm font-semibold text-text">{copy.title}</h3>
                    </div>
                    <p className="font-body text-sm leading-relaxed text-secondary">{copy.body}</p>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
