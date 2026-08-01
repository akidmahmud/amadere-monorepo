"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";
import { StatusSelect } from "@/components/StatusSelect";
import { SearchPickerField } from "@/components/SearchPickerField";
import { usePickerCategories, usePickerProducts } from "@/hooks/usePickers";
import { useDiscount, useUpdateDiscount, type DiscountType, type DiscountValueType } from "@/hooks/useDiscounts";
import type { PublishStatus } from "@/hooks/useBrands";

const discountIcon = <Icon name="local_offer" />;
const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function EditDiscountPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const discountId = Number(id);
  const router = useRouter();
  const { data: discount, isLoading } = useDiscount(discountId);
  const { data: products } = usePickerProducts();
  const { data: categories } = usePickerCategories();
  const update = useUpdateDiscount(discountId);

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

  useEffect(() => {
    if (!discount) return;
    setType(discount.type);
    setCode(discount.code ?? "");
    setValueType(discount.valueType);
    setValue(discount.value);
    setMinOrderAmount(discount.minOrderAmount ?? "");
    setMaxUsesTotal(discount.maxUsesTotal != null ? String(discount.maxUsesTotal) : "");
    setMaxUsesPerCustomer(discount.maxUsesPerCustomer != null ? String(discount.maxUsesPerCustomer) : "");
    setNeverExpires(!discount.endsAt);
    setStartsAt(discount.startsAt?.slice(0, 10) ?? "");
    setEndsAt(discount.endsAt?.slice(0, 10) ?? "");
    setStatus(discount.status);
    setProductIds(discount.productIds);
    setCategoryIds(discount.categoryIds);
  }, [discount]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
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

  if (isLoading || !discount) {
    return (
      <div className="flex flex-col gap-4">
        <PageHeader
          icon={discountIcon}
          title="Edit Discount"
          subtitle="A coupon code customers enter, or a promotion applied automatically."
          style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
        />
        <Card><p className="text-sm text-muted">Loading…</p></Card>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={discountIcon}
        title="Edit Discount"
        subtitle={discount.code ?? `Promotion #${discount.id}`}
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
                <input required value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} className={inputClass} />
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
          <div className="text-xs text-muted">
            Used {discount.usedCount}
            {discount.maxUsesTotal ? ` / ${discount.maxUsesTotal}` : ""} time{discount.usedCount === 1 ? "" : "s"}
          </div>
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

          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        </Card>
      </form>
    </div>
  );
}
