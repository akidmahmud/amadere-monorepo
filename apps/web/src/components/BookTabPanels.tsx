"use client";

import Image from "next/image";
import { useTranslations } from "next-intl";
import { SOCIAL_ICONS, socialFallbackIcon } from "@amader/ui";
import { toDisplayImageUrl, IMG } from "@/lib/media";
import { sanitizeHtml } from "@/lib/sanitize-html";
import type { components } from "@/lib/api/schema";

type PublicProductDetailDto = components["schemas"]["PublicProductDetailDto"];

// Client components, not server ones, for one concrete reason: @amader/ui's
// SOCIAL_ICONS lives in a "use client" module, so every export of it crosses
// the client boundary as a reference proxy when imported from a Server
// Component — the glyphs would not render. Both panels are static markup
// otherwise; nothing here holds state.

/**
 * The DIGITAL PDP's "Specification" tab — the fixed book fields as a
 * two-column table.
 *
 * Fixed named rows rather than free-form pairs, per the owner's decision:
 * every book carries the same seven, so they stay comparable and filterable.
 * A blank field drops its row entirely instead of rendering an empty cell.
 */
export function BookSpecificationPanel({ product }: { product: PublicProductDetailDto }) {
  const t = useTranslations("bookTabs");

  // "Type" — the downloadable file's format and size, e.g. "PDF · 2.3 MB".
  // An ebook has no shipping weight, so the format is what a buyer actually
  // needs; the size matters because most of this store's traffic is on mobile
  // data. Both come straight from the uploaded file (the format is derived
  // from it server-side), so neither can drift from what is delivered.
  const fileType = (() => {
    const format = product.digitalFileFormat;
    if (!format) return "";
    const bytes = product.digitalFileSize;
    if (!bytes || bytes <= 0) return format;
    const mb = bytes / (1024 * 1024);
    const size = mb >= 1 ? `${mb.toFixed(1)} ${t("spec.mb")}` : `${Math.max(1, Math.round(bytes / 1024))} ${t("spec.kb")}`;
    return `${format} · ${size}`;
  })();

  const rows: { label: string; value: string }[] = [
    { label: t("spec.edition"), value: product.bookEdition ?? "" },
    { label: t("spec.isbn"), value: product.isbn ?? "" },
    // "No of Page" is the real page count of the PDF being sold — read off
    // the file at upload time, never hand-typed, so it cannot disagree with
    // what the buyer downloads.
    { label: t("spec.pages"), value: product.digitalPageCount != null ? String(product.digitalPageCount) : "" },
    { label: t("spec.language"), value: product.bookLanguage ?? "" },
    { label: t("spec.publisher"), value: product.bookPublisher ?? "" },
    { label: t("spec.country"), value: product.bookCountry ?? "" },
    { label: t("spec.type"), value: fileType },
  ].filter((row) => row.value !== "");

  if (rows.length === 0) {
    return <p className="font-body text-sm text-secondary">{t("spec.empty")}</p>;
  }

  return (
    // overflow-x-auto is belt-and-braces: the table fits at 390px, but a very
    // long publisher name should scroll its own box, never the page. No
    // negative margin here — an earlier -mx-1 pulled the table under the
    // card's padding and, because this box clips, sheared the first glyph off
    // every Bengali row label.
    <div className="overflow-x-auto">
      <table className="w-full min-w-[280px] border-collapse text-left">
        <tbody>
          {rows.map((row) => (
            <tr key={row.label} className="border-b border-[#eee] last:border-b-0">
              <th scope="row" className="w-[45%] py-2.5 pr-3 align-top font-ui text-xs font-semibold text-muted sm:w-[30%] sm:text-sm">
                {row.label}
              </th>
              <td className="py-2.5 align-top font-body text-xs font-medium text-ink sm:text-sm">{row.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The DIGITAL PDP's "Author" tab — photo, name, bio and social icons.
 *
 * There is deliberately NO follow button: the owner asked for social icons
 * "instead of a follow button", and nothing in this app models following an
 * author. The icons are the only outbound action.
 */
export function BookAuthorPanel({ author }: { author: NonNullable<PublicProductDetailDto["author"]> }) {
  const t = useTranslations("bookTabs");
  const photo = toDisplayImageUrl(author.photoUrl, IMG.thumb);

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:gap-6">
      {photo && (
        <Image
          src={photo}
          alt={author.name}
          width={112}
          height={112}
          className="h-24 w-24 shrink-0 rounded-full border border-line object-cover sm:h-28 sm:w-28"
        />
      )}
      <div className="min-w-0 flex-1">
        <h3 className="mb-1 font-ui text-base font-bold text-[#222831] sm:text-lg">{author.name}</h3>

        {author.bio ? (
          // Admin-authored CKEditor HTML, same trust level and same
          // sanitisation as the product description tabs beside it.
          // eslint-disable-next-line react/no-danger
          <div className="rich-content" dangerouslySetInnerHTML={{ __html: sanitizeHtml(author.bio) }} />
        ) : (
          <p className="font-body text-sm text-secondary">{t("authorPanel.noBio", { name: author.name })}</p>
        )}

        {author.socialLinks.length > 0 && (
          <div className="mt-4 flex flex-wrap gap-2">
            {author.socialLinks.map((link, index) => (
              <a
                key={index}
                href={link.url}
                target="_blank"
                // noreferrer alongside noopener because these are outbound
                // links to accounts the store does not control.
                rel="noopener noreferrer nofollow"
                aria-label={link.label ?? link.icon}
                title={link.label ?? link.icon}
                className="grid h-10 w-10 place-items-center rounded-full border-[1.5px] border-green text-green transition-colors hover:bg-green hover:text-white"
              >
                {SOCIAL_ICONS[link.icon] ?? socialFallbackIcon}
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
