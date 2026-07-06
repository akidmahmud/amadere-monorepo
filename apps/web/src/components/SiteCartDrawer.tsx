"use client";

import { CartDrawer } from "@amader/ui";
import { useTranslations } from "next-intl";
import { useRouter } from "@/i18n/navigation";

export function SiteCartDrawer() {
  const t = useTranslations("cart");
  const router = useRouter();

  return (
    <CartDrawer
      title={t("title")}
      emptyLabel={t("empty")}
      checkoutLabel={t("checkout")}
      closeLabel={t("close")}
      subtotalLabel={t("subtotal")}
      onCheckout={() => router.push("/checkout")}
    />
  );
}
