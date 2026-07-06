/** next-intl locales are lowercase ("en"/"bn"); the backend's Locale enum is uppercase. */
export function toApiLocale(locale: string): "EN" | "BN" {
  return locale === "bn" ? "BN" : "EN";
}
