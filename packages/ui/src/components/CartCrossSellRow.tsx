"use client";

import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { formatMoney } from "./PriceTag";

export interface CartCrossSellItem {
  id: number;
  href: string;
  name: string;
  price?: string | null;
  imageUrl?: string | null;
}

export interface CartCrossSellRowProps {
  heading: string;
  items: CartCrossSellItem[];
  onAdd: (id: number) => void;
  addLabel?: string;
  linkComponent?: LinkComponent;
}

export function CartCrossSellRow({
  heading,
  items,
  onAdd,
  addLabel = "Add",
  linkComponent: Link = DefaultLink,
}: CartCrossSellRowProps) {
  if (items.length === 0) return null;

  return (
    <div className="border-t border-line py-3">
      <p className="mb-2.5 font-ui text-xs font-semibold uppercase tracking-wide text-muted">{heading}</p>
      <div className="space-y-2.5">
        {items.map((item) => (
          <div key={item.id} className="flex items-center gap-2.5">
            <Link href={item.href} className="h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-line bg-white">
              {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />}
            </Link>
            <div className="min-w-0 flex-1">
              <Link href={item.href} className="block truncate font-ui text-xs text-ink">
                {item.name}
              </Link>
              {item.price && <span className="font-body text-xs text-muted">{formatMoney(item.price)}</span>}
            </div>
            <button
              type="button"
              onClick={() => onAdd(item.id)}
              className="shrink-0 rounded-full border border-green px-2.5 py-1 font-ui text-[11px] font-semibold text-green"
            >
              {addLabel}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
