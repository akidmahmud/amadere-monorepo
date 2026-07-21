"use client";

import { Footer } from "@amader/ui";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { useSubscribeNewsletter } from "@/hooks/useNewsletter";

const FOOTER_BOTTOM_IMAGE_URL =
  "https://pub-51174804638049198acba5bbf211435e.r2.dev/image/8ba98d02-41d1-4d55-b9d4-e992a7fa5449-footer-bottom.png";
// Dedicated white-on-transparent footer logo (distinct from the header's
// logo, which is a green mark meant for a white background) — the green
// header mark has very low contrast against this footer's dark green
// background.
const FOOTER_LOGO_URL =
  "https://pub-51174804638049198acba5bbf211435e.r2.dev/image/b6db0193-e4a3-4651-a473-243e5911dbd5-footer-logo-white.png";

export function SiteFooter() {
  const t = useTranslations("footer");
  const subscribe = useSubscribeNewsletter();

  return (
    <Footer
      brandMark="আমাদের"
      logoUrl={FOOTER_LOGO_URL}
      bottomImageUrl={FOOTER_BOTTOM_IMAGE_URL}
      newsletterHeading={t("newsletterHeading")}
      newsletterPlaceholder={t("newsletterPlaceholder")}
      subscribeLabel={subscribe.isSuccess ? "Subscribed!" : t("subscribe")}
      onSubscribe={(email) => subscribe.mutate(email)}
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
