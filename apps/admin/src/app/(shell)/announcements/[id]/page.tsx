"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useAnnouncements, useUpdateAnnouncement } from "@/hooks/useAnnouncements";

const inputClass = "h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500";

export default function EditAnnouncementPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const announcementId = Number(id);
  const router = useRouter();
  const { data: items, isLoading } = useAnnouncements();
  const item = items?.find((i) => i.id === announcementId);
  const update = useUpdateAnnouncement(announcementId);

  const [message, setMessage] = useState("");
  const [linkUrl, setLinkUrl] = useState("");
  const [isActive, setIsActive] = useState(true);

  useEffect(() => {
    if (!item) return;
    setMessage(item.translations[0]?.message ?? "");
    setLinkUrl(item.linkUrl ?? "");
    setIsActive(item.isActive);
  }, [item]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await update.mutateAsync({
      linkUrl: linkUrl || undefined,
      isActive,
      translations: [{ locale: "EN", message }, { locale: "BN", message }],
    });
    router.push("/announcements");
  }

  if (isLoading || !item) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <Card className="max-w-xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Message</span>
          <input required value={message} onChange={(e) => setMessage(e.target.value)} className={inputClass} />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Link (optional)</span>
          <input value={linkUrl} onChange={(e) => setLinkUrl(e.target.value)} className={inputClass} />
        </label>
        <label className="flex items-center gap-2 text-sm text-text">
          <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
          Active
        </label>

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Link href="/announcements">
            <Button type="button" variant="ghost">Cancel</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
