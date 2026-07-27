import { SectionHeading } from "./SectionHeading";

export interface ProductComparisonRow {
  feature: string;
  own: boolean;
  competitor: boolean;
}

export interface ProductComparisonTableProps {
  title?: string | null;
  ownLabel?: string | null;
  competitorLabel?: string | null;
  rows: ProductComparisonRow[];
}

function Check({ on }: { on: boolean }) {
  return on ? (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" className="mx-auto text-green">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" className="mx-auto text-line">
      <circle cx="12" cy="12" r="9" />
      <line x1="8" y1="8" x2="16" y2="16" />
      <line x1="16" y1="8" x2="8" y2="16" />
    </svg>
  );
}

// Admin-configured "Why Choose Us" table — hidden entirely when the admin
// hasn't filled in any rows, so it's an opt-in section per product.
export function ProductComparisonTable({ title, ownLabel, competitorLabel, rows }: ProductComparisonTableProps) {
  if (rows.length === 0) return null;

  return (
    // Hidden on mobile — the table doesn't collapse well at narrow widths
    // and isn't essential there; desktop-only per design.
    <div className="mx-auto hidden w-full max-w-[1180px] px-5 py-14 md:block">
      <SectionHeading>{title || `Why Choose ${ownLabel || "This Product"}?`}</SectionHeading>
      <div className="mx-auto max-w-[920px] overflow-x-auto">
        <table className="w-full min-w-[480px] border-separate border-spacing-0 overflow-hidden rounded-brand border border-line bg-white">
          <thead>
            <tr>
              <th className="border-b border-line bg-white p-4 text-left font-ui text-sm font-bold text-ink" />
              <th className="border-b border-line bg-green p-4 font-ui text-sm font-bold text-white">
                {ownLabel || "This Product"}
              </th>
              <th className="border-b border-line bg-white p-4 font-ui text-sm font-bold text-ink">
                {competitorLabel || "Regular Alternative"}
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                <td className="border-b border-line p-4 font-ui text-sm font-semibold text-text last:border-b-0">
                  {row.feature}
                </td>
                <td className="border-b border-line bg-[#e8f4ea] p-4 last:border-b-0">
                  <Check on={row.own} />
                </td>
                <td className="border-b border-line p-4 last:border-b-0">
                  <Check on={row.competitor} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
