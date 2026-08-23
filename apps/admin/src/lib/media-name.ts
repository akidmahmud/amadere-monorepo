/**
 * A human-readable name for a media row.
 *
 * There is no `name` column — the library stores only the URL. But every
 * upload key is `{uuid}-{originalFilename}`, so the original name is
 * recoverable by stripping the UUID prefix. That works for every existing
 * row without a migration, which matters: only 5 of ~160 rows have alt text
 * set, so alt text cannot serve as the name.
 *
 * Falls back to the whole last segment if the prefix isn't a UUID (migrated
 * rows, derivative files like `backfill-282-card.webp`).
 */
const UUID_PREFIX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}-/i;

export function mediaDisplayName(url: string): string {
  const lastSlash = url.lastIndexOf("/");
  const segment = lastSlash >= 0 ? url.slice(lastSlash + 1) : url;

  // URLs are percent-encoded on disk (a space is stored as %20), so decode
  // before showing it to a human.
  let name = segment;
  try {
    name = decodeURIComponent(segment);
  } catch {
    // Malformed escape sequence — show the raw segment rather than throwing.
  }

  const stripped = name.replace(UUID_PREFIX, "");
  return stripped || name;
}

/** Extension, uppercased, for the details panel's type row. Empty when the
 * filename has none. */
export function mediaExtension(url: string): string {
  const name = mediaDisplayName(url);
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot + 1).toUpperCase() : "";
}
