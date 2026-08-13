"use client";

import { Footer } from "@amader/ui";
import { useLocale, useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSiteInfo } from "@/hooks/useSiteInfo";
import { useNavMenu } from "@/hooks/useNavMenu";
import { toApiLocale } from "@/lib/api-locale";

export interface SiteFooterProps {
  /** Same server-fetched values SiteHeader already receives from layout.tsx
   * — reused here so the footer's logo/Shop-By column don't wait on a
   * second client-side fetch of data the layout already has. */
  initialLogoUrl?: string | null;
  initialNavMenu?: Parameters<typeof useNavMenu>[1];
}

export function SiteFooter({ initialLogoUrl, initialNavMenu }: SiteFooterProps = {}) {
  const t = useTranslations("footer");
  const locale = useLocale();
  const { data: siteInfo } = useSiteInfo();
  const { data: navMenu } = useNavMenu(toApiLocale(locale), initialNavMenu);
  const logoUrl = siteInfo?.logoUrl ?? initialLogoUrl ?? undefined;

  const isBn = locale.toUpperCase() === "BN";

  const aboutLinks = [
    { label: isBn ? "আমাদের™ সম্পর্কে" : "About Amader™", href: "/pages/about-us" },
    { label: isBn ? "আমাদের™ ব্র্যান্ড" : "Amader™ Brand", href: "/pages/amader-brand" },
    { label: isBn ? "যোগাযোগ" : "Contact Amader™", href: "/pages/contact" },
    { label: isBn ? "আমাদের™ অঙ্গীকার" : "Amader™ Commitment", href: "/pages/amader-commitment" },
    { label: isBn ? "কর্পোরেট সেলস" : "Corporate Sales", href: "/pages/corporate-sales" },
    { label: isBn ? "আমাদের™ ভিশন ও মিশন" : "Amader™ Vision Mission", href: "/pages/vision-mission" },
    { label: isBn ? "সচরাচর জিজ্ঞাসা" : "Frequently Asked Questions", href: "/pages/faq" },
  ];

  const policyLinks = [
    { label: isBn ? "শর্তাবলী" : "Terms & Conditions", href: "/pages/terms-conditions" },
    { label: isBn ? "গোপনীয়তা নীতি" : "Privacy Policies", href: "/pages/privacy-policy" },
    { label: isBn ? "রিটার্ন ও এক্সচেঞ্জ" : "Returns & Exchanges", href: "/pages/refund-policy" },
    { label: isBn ? "শিপিং ও ডেলিভারি" : "Shipping & Delivery", href: "/pages/shipping-delivery" },
    { label: isBn ? "কর্মক্ষেত্রের নীতি" : "Workplace Policy", href: "/pages/workplace-policy" },
    { label: isBn ? "স্বাস্থ্য ও নিরাপত্তা নীতি" : "Health & Safety Policy", href: "/pages/health-safety-policy" },
    { label: isBn ? "হালাল ব্যবসায়িক অঙ্গীকার" : "Halal Business Commitment", href: "/pages/halal-commitment" },
    { label: isBn ? "আমাদের অঙ্গীকার" : "Amader Commitment", href: "/pages/amader-commitment" },
    { label: isBn ? "কুকি নীতি" : "Cookie Policy", href: "/pages/cookie-policy" },
  ];

  const categoryLinks = [
    { label: isBn ? "আমাদের ছাতু" : "Amader Chatu", href: "/categories/amader-chatu" },
    { label: isBn ? "আমাদের আটা" : "Amader Atta", href: "/categories/amader-atta" },
    { label: isBn ? "আমাদের তেল" : "Amader Oil", href: "/categories/amader-oil" },
    { label: isBn ? "আমাদের মধু" : "Amader Modhu", href: "/categories/amader-modhu" },
    { label: isBn ? "আমাদের হার্বস" : "Amader Herbs", href: "/categories/amader-herbs" },
    { label: isBn ? "আমাদের সুপার ফুড" : "Amader Super Food", href: "/categories/amader-super-food" },
    { label: isBn ? "আমাদের চাল" : "Amader Rice", href: "/categories/amader-rice" },
    { label: isBn ? "আমাদের মশলা" : "Amader Spices", href: "/categories/amader-spices" },
  ];

  const descriptionText =
    "Amader™ (আমাদের™) কেবল একটি ফুড ব্র্যান্ড নয়, এটি বিশুদ্ধতা, বিশ্বাস এবং যত্নের প্রতিশ্রুতি। Amader™ নিশ্চিত করে প্রতিটি পণ্য ১০০% বিশুদ্ধ, ন্যাচারাল এবং স্বাস্থ্যকর। আমাদের লক্ষ্য মানুষকে প্রাচীন ন্যাচারাল খাঁটি, স্বাস্থ্যকর খাবারের সাথে পুনরায় সংযুক্ত করে এমন একটি ভবিষ্যত তৈরি করা যেখানে স্বাস্থ্য, স্বাদ এবং প্রকৃতি মিলেমিশে বাস করে ওষুধ ছাড়া।";

  return (
    <Footer
      brandMark="আমাদের"
      logoUrl={logoUrl}
      description={descriptionText}
      address="Address: Salna, Gazipur"
      phone="Call Us: +8801615980394"
      workingHours="Working Hours: 10am to 8pm"
      facebookHref="https://www.facebook.com/amaderecommerce"
      instagramHref="https://www.instagram.com/amaderebuy"
      youtubeHref="https://www.youtube.com/@amadere"
      googlePlayHref="#"
      appStoreHref="#"
      appDownloadLabel={t("appDownloadLabel")}
      columns={[
        { heading: isBn ? "আমাদের™ সম্পর্কে" : "About Amader™", links: aboutLinks },
        { heading: isBn ? "আমাদের™ পলিসি" : "Amader™ Policy", links: policyLinks },
        { heading: isBn ? "পণ্য বিভাগ" : "Product Categories", links: categoryLinks },
      ]}
      copyrightLabel={t("copyright", { year: new Date().getFullYear() })}
      payWithLabel={t("payWith")}
      paymentImageUrl="/images/payment-methods-placeholder.png"
      linkComponent={Link}
    />
  );
}
