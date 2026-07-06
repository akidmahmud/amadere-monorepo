"use client";

import { Header, Nav } from "@amader/ui";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, usePathname, Link } from "@/i18n/navigation";
import { navConfig } from "@/config/nav";

export function SiteHeader() {
  const t = useTranslations();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const otherLocale = locale === "en" ? "bn" : "en";

  const items = navConfig.map((item) => ({
    key: item.key,
    href: item.href,
    hasChildren: "hasChildren" in item ? item.hasChildren : undefined,
    label: t(`nav.${item.key}`),
  }));

  return (
    <>
      <Header
        brandHref="/"
        brandMark="আমাদের"
        searchPlaceholder={t("header.searchPlaceholder")}
        searchAriaLabel={t("header.searchAria")}
        trackOrderHref="/track"
        trackOrderLabel={t("header.trackOrder")}
        cartLabel={t("header.cart")}
        localeSwitchLabel={t("header.localeSwitch")}
        onLocaleSwitch={() => router.replace(pathname, { locale: otherLocale })}
        linkComponent={Link}
      />
      <Nav items={items} activeHref={pathname} linkComponent={Link} />
    </>
  );
}
