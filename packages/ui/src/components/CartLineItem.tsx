"use client";

import { DefaultLink, type LinkComponent } from "../lib/link-component";
import { QtyStepper } from "./QtyStepper";
import { formatMoney } from "./PriceTag";

const trashIcon = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} className="h-4 w-4">
    <path d="M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14" />
  </svg>
);

export interface CartLineItemData {
  id: number;
  href: string;
  name: string;
  imageUrl?: string | null;
  variantLabel?: string | null;
  quantity: number;
  unitPrice: string;
  lineTotal: string;
}

export interface CartLineItemProps {
  item: CartLineItemData;
  onQuantityChange: (quantity: number) => void;
  onRemove: () => void;
  linkComponent?: LinkComponent;
}

export function CartLineItem({ item, onQuantityChange, onRemove, linkComponent: Link = DefaultLink }: CartLineItemProps) {
  return (
    <div className="flex items-center gap-3 border-b border-line py-3">
      <Link href={item.href} className="h-[46px] w-[46px] shrink-0 overflow-hidden rounded-lg border border-line bg-white">
        {item.imageUrl && <img src={item.imageUrl} alt={item.name} className="h-full w-full object-cover" />}
      </Link>
      <div className="min-w-0 flex-1">
        <Link href={item.href} className="mb-1.5 block truncate font-ui text-[13px] text-ink">
          {item.name}
        </Link>
        {item.variantLabel && <p className="mb-1.5 text-xs text-muted">{item.variantLabel}</p>}
        <div className="flex items-center gap-2.5">
          <QtyStepper value={item.quantity} onChange={onQuantityChange} />
          <span className="font-body text-sm text-ink">{formatMoney(item.lineTotal)}</span>
        </div>
      </div>
      <button type="button" aria-label={`Remove ${item.name}`} onClick={onRemove} className="shrink-0 text-muted hover:text-ink">
        {trashIcon}
      </button>
    </div>
  );
}
