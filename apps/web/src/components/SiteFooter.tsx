"use client";

import { Footer } from "@amader/ui";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

export function SiteFooter() {
  const t = useTranslations("footer");

  return (
    <Footer
      brandMark="আমাদের"
      newsletterHeading={t("newsletterHeading")}
      newsletterPlaceholder={t("newsletterPlaceholder")}
      subscribeLabel={t("subscribe")}
      columns={[
        {
          heading: t("aboutHeading"),
          links: [
            { label: t("about"), href: "/about" },
            { label: t("blog"), href: "/blog" },
            { label: t("certifications"), href: "/certifications" },
            { label: t("farmers"), href: "/farmers" },
          ],
        },
        {
          heading: t("helpHeading"),
          links: [
            { label: t("consult"), href: "/consult" },
            { label: t("faqs"), href: "/faqs" },
            { label: t("terms"), href: "/terms" },
            { label: t("privacy"), href: "/privacy" },
          ],
        },
      ]}
      contact={t("contactHeading")}
      rightsLabel={`© ${new Date().getFullYear()} আমাদের — ${t("rights")}`}
      linkComponent={Link}
    />
  );
}
