"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";
import { StatusSelect } from "@/components/StatusSelect";
import { SearchPickerField } from "@/components/SearchPickerField";
import { usePickerCategories, usePickerProducts } from "@/hooks/usePickers";
import { useCreateDiscount, type DiscountType, type DiscountValueType } from "@/hooks/useDiscounts";
import type { PublishStatus } from "@/hooks/useBrands";

const discountIcon = <Icon name="local_offer" />;
const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

function generateCode(): string {
  return Array.from({ length: 8 }, () => "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"[Math.floor(Math.random() * 32)]).join("");
}

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
  const [neverExpires, setNeverExpires] = useState(true);
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [status, setStatus] = useState<PublishStatus>("DRAFT");
  const [productIds, setProductIds] = useState<number[]>([]);
  const [categoryIds, setCategoryIds] = useState<number[]>([]);
  const create = useCreateDiscount();

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
      endsAt: neverExpires ? undefined : endsAt || undefined,
      status,
      productIds,
      categoryIds,
    });
    router.push("/discounts");
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={discountIcon}
        title="Create Discount"
        subtitle="A coupon code customers enter, or a promotion applied automatically."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
      />
      <Link href="/discounts" className="flex items-center gap-1.5 text-sm font-semibold text-brand-500">
        <Icon name="arrow_back" size={16} /> Back to Discounts
      </Link>

      <form onSubmit={handleSubmit} className="grid grid-cols-[2fr_1fr] gap-4 max-lg:grid-cols-1">
        <Card className="flex flex-col gap-5">
          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Type</span>
              <select value={type} onChange={(e) => setType(e.target.value as DiscountType)} className={inputClass}>
                <option value="COUPON">Coupon code</option>
                <option value="PROMOTION">Promotion (applies automatically)</option>
              </select>
            </label>
            {type === "COUPON" && (
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">Coupon code</span>
                <div className="flex gap-2">
                  <input
                    required
                    value={code}
                    onChange={(e) => setCode(e.target.value.toUpperCase())}
                    className={inputClass}
                  />
                  <Button type="button" variant="ghost" onClick={() => setCode(generateCode())}>
                    Generate
                  </Button>
                </div>
              </label>
            )}
          </div>

          <div className="flex gap-4">
            <label className="flex flex-1 flex-col gap-1.5">
              <span className="text-xs font-semibold text-secondary">Discount type</span>
              <select value={valueType} onChange={(e) => setValueType(e.target.value as DiscountValueType)} className={inputClass}>
                <option value="PERCENTAGE">Percentage discount (%)</option>
                <option value="FIXED_AMOUNT">Fixed amount (৳)</option>
                <option value="FREE_SHIPPING">Free shipping</option>
              </select>
            </label>
            {valueType !== "FREE_SHIPPING" && (
              <label className="flex flex-1 flex-col gap-1.5">
                <span className="text-xs font-semibold text-secondary">
                  Value {valueType === "PERCENTAGE" ? "(%)" : "(৳)"}
                </span>
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

          <SearchPickerField
            label="Restrict to products (none = all)"
            options={products ?? []}
            selected={productIds}
            onChange={setProductIds}
            placeholder="Search products..."
          />
          <SearchPickerField
            label="Restrict to categories (none = all)"
            options={categories ?? []}
            selected={categoryIds}
            onChange={setCategoryIds}
            placeholder="Search categories..."
          />
          <p className="text-xs text-muted">
            Restricting to specific customers isn&apos;t available here — there&apos;s no admin customer picker for it yet.
          </p>
        </Card>

        <Card className="flex h-fit flex-col gap-4">
          <h3 className="font-ui text-sm font-bold text-text">Schedule</h3>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Starts (optional)</span>
            <input type="date" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-secondary">Ends</span>
            <input
              type="date"
              value={endsAt}
              disabled={neverExpires}
              onChange={(e) => setEndsAt(e.target.value)}
              className={`${inputClass} disabled:opacity-50`}
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-text">
            <input type="checkbox" checked={neverExpires} onChange={(e) => setNeverExpires(e.target.checked)} />
            Never expires
          </label>

          <StatusSelect value={status} onChange={setStatus} />

          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Save"}
          </Button>
        </Card>
      </form>
    </div>
  );
}
