"use client";

import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useDeleteDiscount, useDiscounts } from "@/hooks/useDiscounts";

function valueLabel(discount: { valueType: string; value: string }) {
  if (discount.valueType === "FREE_SHIPPING") return "Free shipping";
  if (discount.valueType === "PERCENTAGE") return `${discount.value}% off`;
  return `৳${discount.value} off`;
}

export default function DiscountsPage() {
  const { data: discounts, isLoading } = useDiscounts();
  const deleteDiscount = useDeleteDiscount();

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{discounts?.length ?? 0} discounts</p>
        <Link href="/discounts/new">
          <Button variant="primary">Add discount</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {discounts && discounts.length === 0 && <p className="text-sm text-muted">No discounts yet.</p>}

      <div className="flex flex-col gap-3">
        {discounts?.map((discount) => (
          <Card key={discount.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold text-text">{discount.code ?? `Promotion #${discount.id}`}</div>
              <div className="text-xs text-muted">
                {discount.type} · {valueLabel(discount)} · {discount.status} · used {discount.usedCount}
                {discount.maxUsesTotal ? `/${discount.maxUsesTotal}` : ""}
              </div>
            </div>
            <Link href={`/discounts/${discount.id}`}>
              <Button type="button" variant="ghost">
                Edit
              </Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${discount.code ?? `Promotion #${discount.id}`}"?`)) deleteDiscount.mutate(discount.id);
              }}
            >
              Delete
            </Button>
          </Card>
        ))}
      </div>
    </>
  );
}
