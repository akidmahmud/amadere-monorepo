export interface ComparisonCardData {
  imageUrl?: string | null;
  title?: string | null;
  /** One bullet line per line of text, same convention as keyBenefits. */
  items?: string | null;
}

export interface ComparisonSectionProps {
  /** Admin-authored HTML (same trust level as description/content elsewhere). */
  headingHtml?: string | null;
  /** "Us" card — always styled with green checkmarks. */
  card1?: ComparisonCardData | null;
  /** "Them" card — always styled with red X marks. */
  card2?: ComparisonCardData | null;
}

function toItems(items?: string | null): string[] {
  return (items ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

const CheckIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0">
    <circle cx="10" cy="10" r="10" fill="#22C55E" />
    <path d="M6 10.5 8.5 13 14 7.5" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const XIcon = () => (
  <svg viewBox="0 0 20 20" fill="none" className="h-5 w-5 shrink-0">
    <circle cx="10" cy="10" r="10" fill="#EF4444" />
    <path d="M7 7 13 13M13 7 7 13" stroke="white" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

function ComparisonCard({ card, variant }: { card: ComparisonCardData; variant: "us" | "them" }) {
  const items = toItems(card.items);
  return (
    <div className="w-full max-w-[440px] overflow-hidden rounded-3xl bg-white shadow-brand">
      {card.imageUrl && (
        <div className="aspect-[4/3] overflow-hidden bg-beige">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={card.imageUrl} alt="" className="h-full w-full object-cover" />
        </div>
      )}
      <div className="p-6">
        {card.title && <h3 className="mb-4 font-serif text-xl font-bold text-ink">{card.title}</h3>}
        {items.length > 0 && (
          <ul className="space-y-3">
            {items.map((item, i) => (
              <li key={i} className="flex items-start gap-3">
                {variant === "us" ? <CheckIcon /> : <XIcon />}
                <span className="font-body text-sm leading-snug text-ink">{item}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

// Background is a full-bleed vector scene (green→yellow gradient + a soft
// radial glow), same "preserveAspectRatio=none" approach as
// ProductInfoVisual's gold background — stretches to fill any content
// height with zero crop risk since it's vector, not raster.
export function ComparisonSection({ headingHtml, card1, card2 }: ComparisonSectionProps) {
  if (!headingHtml && !card1 && !card2) return null;

  return (
    <div className="relative overflow-hidden">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1920 1200" preserveAspectRatio="none" aria-hidden>
        <defs>
          <linearGradient id="cmpBg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#2F7D39" />
            <stop offset="30%" stopColor="#3E9240" />
            <stop offset="60%" stopColor="#7CA94A" />
            <stop offset="85%" stopColor="#D9CC72" />
            <stop offset="100%" stopColor="#F5E7A2" />
          </linearGradient>
          <radialGradient id="cmpGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#FFFFFF" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#FFFFFF" stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="1920" height="1200" fill="url(#cmpBg)" />
        <ellipse cx="960" cy="820" rx="850" ry="450" fill="url(#cmpGlow)" />
      </svg>

      <div className="relative z-[1] mx-auto max-w-[1180px] px-5 py-16">
        {headingHtml && (
          // eslint-disable-next-line react/no-danger
          <h2
            className="mb-10 text-center font-serif text-3xl font-bold leading-snug text-white"
            dangerouslySetInnerHTML={{ __html: headingHtml }}
          />
        )}
        <div className="flex flex-wrap items-start justify-center gap-8">
          {card1 && <ComparisonCard card={card1} variant="us" />}
          {card2 && <ComparisonCard card={card2} variant="them" />}
        </div>
      </div>
    </div>
  );
}
