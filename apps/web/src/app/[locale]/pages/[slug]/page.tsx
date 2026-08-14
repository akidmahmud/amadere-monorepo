import { permanentRedirect } from "@/i18n/navigation";

export default async function LegacyCMSPageRedirect({
  params,
}: {
  params: Promise<{ locale: string; slug: string }>;
}) {
  const { locale, slug } = await params;
  permanentRedirect({ href: `/${slug}`, locale });
}
