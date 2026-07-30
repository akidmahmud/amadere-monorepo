const FIELD_LABELS: Record<string, string> = {
  name: "Name",
  title: "Title",
  slug: "Slug",
  description: "Short Description",
  content: "Content",
  excerpt: "Excerpt",
  metaDescription: "Meta description",
  sku: "SKU",
};

function fieldLabel(path: string): string {
  const last = path.split(".").pop() ?? path;
  const known = FIELD_LABELS[last];
  if (known) return known;
  return last.charAt(0).toUpperCase() + last.slice(1);
}

// Only rewrites the handful of class-validator phrasings that actually show
// up from this app's DTOs — anything else passes through as-is rather than
// risk mangling a message this doesn't recognize.
function humanizeConstraint(message: string): string {
  const maxLen = message.match(/must be shorter than or equal to (\d+) characters/);
  if (maxLen) return `is too long — please keep it under ${maxLen[1]} characters`;
  const minLen = message.match(/must be longer than or equal to (\d+) characters/);
  if (minLen) return `is too short — please use at least ${minLen[1]} characters`;
  if (/should not be empty/.test(message)) return "is required";
  return message;
}

// Backend validation errors are raw class-validator output — several
// comma-joined messages keyed by internal field paths like
// "translations.0.description" (not something a non-technical admin user
// can act on). Rewrites into plain field-name + plain-English constraints,
// deduping the same field repeated across EN/BN translations.
export function friendlyErrorMessage(raw: string): string {
  const parts = raw
    .split(/,\s*/)
    .map((p) => p.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const friendly: string[] = [];
  for (const part of parts) {
    const match = part.match(/^([\w.]+)\s+(.*)$/);
    if (!match) continue;
    const [, path, constraint] = match;
    const label = fieldLabel(path);
    if (seen.has(label)) continue;
    seen.add(label);
    friendly.push(`${label} ${humanizeConstraint(constraint)}`);
  }

  return friendly.length > 0 ? friendly.join(". ") : "Something went wrong. Please check the form and try again.";
}
