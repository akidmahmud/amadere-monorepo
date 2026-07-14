"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useCreateMenuItem, useMenuItems } from "@/hooks/useMenuItems";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function NewMenuItemPage() {
  const router = useRouter();
  const { data: items } = useMenuItems();
  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [parentId, setParentId] = useState<number | undefined>();
  const [isActive, setIsActive] = useState(true);
  const create = useCreateMenuItem();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      href,
      parentId,
      sortOrder: 0,
      isActive,
      translations: [{ locale: "EN", label }, { locale: "BN", label }],
    });
    router.push("/menu-items");
  }

  return (
    <Card className="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Label</span>
          <input required value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Link (e.g. /categories/spices)</span>
          <input required value={href} onChange={(e) => setHref(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Parent item (optional)</span>
          <select value={parentId ?? ""} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : undefined)} className={inputClass}>
            <option value="">None (top-level)</option>
            {items?.map((i) => (
              <option key={i.id} value={i.id}>{i.translations[0]?.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create menu item"}
          </Button>
          <Link href="/menu-items">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
