"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useMenuItems, useUpdateMenuItem } from "@/hooks/useMenuItems";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function EditMenuItemPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const itemId = Number(id);
  const router = useRouter();
  const { data: items, isLoading } = useMenuItems();
  const item = items?.find((i) => i.id === itemId);
  const update = useUpdateMenuItem(itemId);

  const [label, setLabel] = useState("");
  const [href, setHref] = useState("");
  const [parentId, setParentId] = useState<number | undefined>();
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!item) return;
    setLabel(item.translations[0]?.label ?? "");
    setHref(item.href);
    setParentId(item.parentId ?? undefined);
    setIsActive(item.isActive);
  }, [item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      href,
      parentId,
      isActive,
      translations: [{ locale: "EN", label }, { locale: "BN", label }],
    });
    router.push("/menu-items");
  }

  if (isLoading || !item) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <Card className="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Label</span>
          <input required value={label} onChange={(e) => setLabel(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Link</span>
          <input required value={href} onChange={(e) => setHref(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Parent item (optional)</span>
          <select value={parentId ?? ""} onChange={(e) => setParentId(e.target.value ? Number(e.target.value) : undefined)} className={inputClass}>
            <option value="">None (top-level)</option>
            {items?.filter((i) => i.id !== itemId).map((i) => (
              <option key={i.id} value={i.id}>{i.translations[0]?.label}</option>
            ))}
          </select>
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Link href="/menu-items">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
