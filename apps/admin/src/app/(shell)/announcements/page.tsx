"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { useAnnouncements, useDeleteAnnouncement } from "@/hooks/useAnnouncements";
import { useSiteInfo, useUpsertSetting } from "@/hooks/useSettings";

const ANNOUNCEMENT_BAR_SPEED_KEY = "announcement_bar_speed";

const SPEED_PRESETS = [
  { label: "10s (Fast)", value: 10 },
  { label: "15s (Medium Fast)", value: 15 },
  { label: "20s (Normal)", value: 20 },
  { label: "30s (Slow)", value: 30 },
  { label: "40s (Very Slow)", value: 40 },
];

function AnnouncementSpeedCard() {
  const { data: siteInfo } = useSiteInfo();
  const upsert = useUpsertSetting();
  const [speed, setSpeed] = useState(20);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (siteInfo?.announcementSpeedSeconds) {
      setSpeed(siteInfo.announcementSpeedSeconds);
    }
  }, [siteInfo?.announcementSpeedSeconds]);

  async function handleSave(newSpeed: number) {
    setSpeed(newSpeed);
    await upsert.mutateAsync({ key: ANNOUNCEMENT_BAR_SPEED_KEY, value: { speedSeconds: newSpeed } });
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-ui text-sm font-semibold text-text">Ticker Speed Setting</h3>
          <p className="mt-0.5 text-xs text-muted">
            Control how fast announcement text moves across the top banner on the storefront.
          </p>
        </div>
        {saved && <span className="text-xs font-semibold text-success">✓ Speed Saved</span>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {SPEED_PRESETS.map((preset) => (
          <button
            key={preset.value}
            type="button"
            disabled={upsert.isPending}
            onClick={() => handleSave(preset.value)}
            className={`rounded-sm border px-3 py-1.5 text-xs font-semibold transition-colors ${
              speed === preset.value
                ? "border-brand-500 bg-brand-50 text-brand-500"
                : "border-border bg-surface text-text hover:bg-surface-2"
            }`}
          >
            {preset.label}
          </button>
        ))}
      </div>

      <div className="mt-1 flex items-center gap-3">
        <label className="flex items-center gap-2 text-xs font-semibold text-secondary">
          Custom Duration (seconds):
          <input
            type="number"
            min={3}
            max={120}
            value={speed}
            onChange={(e) => setSpeed(Math.max(3, Number(e.target.value) || 20))}
            className="h-8 w-20 rounded-sm border border-border bg-surface px-2.5 text-xs text-text outline-none focus:border-brand-500"
          />
        </label>
        <Button
          type="button"
          variant="primary"
          disabled={upsert.isPending}
          onClick={() => handleSave(speed)}
        >
          {upsert.isPending ? "Saving…" : "Save Custom Speed"}
        </Button>
      </div>
    </Card>
  );
}

export default function AnnouncementsPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const { data: items, isLoading } = useAnnouncements(searchQuery);
  const deleteItem = useDeleteAnnouncement();

  return (
    <>
      <AnnouncementSpeedCard />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <p className="text-sm text-secondary">{items?.length ?? 0} announcements</p>
          <input
            type="text"
            placeholder="Search announcements..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-[38px] w-[220px] rounded-inner border border-border bg-surface px-3 text-[0.76rem] text-text outline-none focus:border-brand-500"
          />
        </div>
        <Link href="/announcements/new">
          <Button variant="primary">Add announcement</Button>
        </Link>
      </div>

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {items && items.length === 0 && (
        <p className="text-sm text-muted">
          {searchQuery ? `No announcements matching "${searchQuery}".` : "No announcements yet."}
        </p>
      )}

      <div className="flex flex-col gap-3">
        {items?.map((item) => (
          <Card key={item.id} className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-text">{item.translations[0]?.message}</div>
              <div className="text-xs text-muted">
                {item.isActive ? "active" : "inactive"}
                {item.linkUrl && ` · ${item.linkUrl}`}
              </div>
            </div>
            <Link href={`/announcements/${item.id}`}>
              <Button type="button" variant="ghost">Edit</Button>
            </Link>
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                if (confirm(`Delete "${item.translations[0]?.message}"?`)) deleteItem.mutate(item.id);
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
