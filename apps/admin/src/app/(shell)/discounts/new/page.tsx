"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { StatusSelect } from "@/components/StatusSelect";
import { usePickerCategories, usePickerProducts } from "@/hooks/usePickers";
import { useCreateDiscount, type DiscountType, type DiscountValueType } from "@/hooks/useDiscounts";
import type { PublishStatus } from "@/hooks/useBrands";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function NewDiscountPage() {
  const router = useRouter();
  const { data: products } = usePickerProducts();
  const { data: categories } = usePickerCategories();

  const [type, setType] = useState<DiscountType>("COUPON");
  const [code, setCode] = useState("");
  const [valueType, setValueType] = useState<DiscountValueType>("PERCENTAGE");
  const [value, setValue] = useState("");
  const [minOrderAmount, setMinOrderAmount] = useState("");
  const [maxUsesTotal, setMaxUsesTotal] = useState("");
  const [maxUsesPerCustomer, setMaxUsesPerCustomer] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [productIds, setProductIds] = useState<number[]>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const create = useCreateDiscount();

  function toggle(list: number[], id: number, set: (ids: number[]) => void) {
    set(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      code: type === "COUPON" ? code : undefined,
      type,
      valueType,
      value: Number(value) || 0,
      minOrderAmount: minOrderAmount ? Number(minOrderAmount) : undefined,
      maxUsesTotal: maxUsesTotal ? Number(maxUsesTotal) : undefined,
      maxUsesPerCustomer: maxUsesPerCustomer ? Number(maxUsesPerCustomer) : undefined,
      startsAt: startsAt || undefined,
      endsAt: endsAt || undefined,
      status,
      productIds,
      categoryIds,
    });
    router.push("/discounts");
  }

  return (
    <Card className="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Type</span>
            <select value={type} onChange={(e) => setType(e.target.value as DiscountType)} className={inputClass}>
              <option value="COUPON">Coupon (code entered by customer)</option>
              <option value="PROMOTION">Promotion (applies automatically)</option>
            </select>
          </label>
          {type === "COUPON" && (
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Code</span>
              <input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className={inputClass} />
            </label>
          )}
        </div>
        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Value type</span>
            <select value={valueType} onChange={(e) => setValueType(e.target.value as DiscountValueType)} className={inputClass}>
              <option value="PERCENTAGE">Percentage</option>
              <option value="FIXED_AMOUNT">Fixed amount</option>
              <option value="FREE_SHIPPING">Free shipping</option>
            </select>
          </label>
          {valueType !== "FREE_SHIPPING" && (
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Value</span>
              <input type="number" required value={value} onChange={(e) => setValue(e.target.value)} className={`num ${inputClass}`} />
            </label>
          )}
        </div>
        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Min order amount (optional)</span>
            <input type="number" value={minOrderAmount} onChange={(e) => setMinOrderAmount(e.target.value)} className={`num ${inputClass}`} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Max total uses (optional)</span>
            <input type="number" value={maxUsesTotal} onChange={(e) => setMaxUsesTotal(e.target.value)} className={`num ${inputClass}`} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Max uses/customer (optional)</span>
            <input type="number" value={maxUsesPerCustomer} onChange={(e) => setMaxUsesPerCustomer(e.target.value)} className={`num ${inputClass}`} />
          </label>
        </div>
        <div className="flex gap-4">
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Starts (optional)</span>
            <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-1 flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Ends (optional)</span>
            <input type="date" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className={inputClass} />
          </label>
        </div>
        <StatusSelect value={status} onChange={setStatus} />

        <div>
          <span className="mb-2 block text-xs font-semibold text-secondary">Restrict to products (none = all)</span>
          <div className="flex flex-wrap gap-2">
            {products?.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs text-text">
                <input type="checkbox" checked={productIds.includes(p.id)} onChange={() => toggle(productIds, p.id, setProductIds)} />
                {p.label}
              </label>
            ))}
          </div>
        </div>
        <div>
          <span className="mb-2 block text-xs font-semibold text-secondary">Restrict to categories (none = all)</span>
          <div className="flex flex-wrap gap-2">
            {categories?.map((c) => (
              <label key={c.id} className="flex items-center gap-1.5 rounded-pill border border-border bg-surface px-3 py-1.5 text-xs text-text">
                <input type="checkbox" checked={categoryIds.includes(c.id)} onChange={() => toggle(categoryIds, c.id, setCategoryIds)} />
                {c.label}
              </label>
            ))}
          </div>
        </div>
        <p className="text-xs text-muted">
          Restricting to specific customers isn&apos;t available here — there&apos;s no admin customer list/lookup API
          yet.
        </p>

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create discount"}
          </Button>
          <Link href="/discounts">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
