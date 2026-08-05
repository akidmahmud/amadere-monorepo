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

  const shopByLinks = (navMenu ?? [])
    .slice(0, 6)
    .map((item) => ({ label: item.label, href: item.href }));

  return (
    <Footer
      brandMark="আমাদের"
      logoUrl={logoUrl}
      description={t("description")}
      address={t("address")}
      phone={t("phone")}
      email={t("email")}
      facebookHref="#"
      instagramHref="#"
      youtubeHref="#"
      googlePlayHref="#"
      appStoreHref="#"
      appDownloadLabel={t("appDownloadLabel")}
      columns={[
        {
          heading: t("informationHeading"),
          links: [
            { label: t("aboutUs"), href: "#" },
            { label: t("contactUs"), href: "#" },
            { label: t("blog"), href: "/blog" },
            { label: t("terms"), href: "#" },
            { label: t("privacy"), href: "#" },
            { label: t("careers"), href: "#" },
          ],
        },
        { heading: t("shopByHeading"), links: shopByLinks },
        {
          heading: t("supportHeading"),
          links: [
            { label: t("supportCenter"), href: "#" },
            { label: t("howToOrder"), href: "#" },
            { label: t("orderTracking"), href: "/track" },
            { label: t("payment"), href: "#" },
            { label: t("shipping"), href: "#" },
            { label: t("faq"), href: "#" },
          ],
        },
        {
          heading: t("consumerPolicyHeading"),
          links: [
            { label: t("happyReturn"), href: "#" },
            { label: t("refundPolicy"), href: "#" },
            { label: t("exchange"), href: "#" },
            { label: t("cancellation"), href: "#" },
            { label: t("preOrder"), href: "#" },
          ],
        },
      ]}
      copyrightLabel={t("copyright", { year: new Date().getFullYear() })}
      payWithLabel={t("payWith")}
      // Placeholder set of generic card/bank/mobile-wallet marks (no
      // verification/certification badge baked in) — swap for Amader's own
      // real payment-partner set later.
      paymentImageUrl="/images/payment-methods-placeholder.png"
      linkComponent={Link}
    />
  );
}
