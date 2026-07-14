"use client";

import { Card } from "@amader/admin-ui";
import { useNewsletterSubscribers } from "@/hooks/useNewsletter";

export default function NewsletterPage() {
  const { data: subscribers, isLoading } = useNewsletterSubscribers();

  return (
    <>
      <p className="text-sm text-secondary">{subscribers?.length ?? 0} subscribers</p>
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {subscribers && subscribers.length === 0 && <p className="text-sm text-muted">No subscribers yet.</p>}

      <div className="flex flex-col gap-2">
        {subscribers?.map((s) => (
          <Card key={s.id} className="flex items-center justify-between py-3">
            <span className="text-sm text-text">{s.email}</span>
            <span className="text-xs text-muted">
              {s.status} · subscribed {new Date(s.subscribedAt).toLocaleDateString()}
            </span>
          </Card>
        ))}
      </div>
    </>
  );
}
