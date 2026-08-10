"use client";

import Link from "next/link";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";
import { useDeleteCampaign, useNewsletterCampaigns } from "@/hooks/useNewsletterCampaigns";

const campaignsIcon = <Icon name="campaign" />;

const STATUS_PILL: Record<string, string> = {
  DRAFT: "bg-surface-2 text-secondary",
  SCHEDULED: "bg-[#e6effe] text-[#2a6fee]",
  SENDING: "bg-[#fdf1dc] text-[#e0821c]",
  SENT: "bg-[#e3f7ee] text-[#16a06d]",
  PARTIALLY_SENT: "bg-[#fdf1dc] text-[#e0821c]",
  FAILED: "bg-[#feeaec] text-[#e8465e]",
};

export default function NewsletterCampaignsPage() {
  const { data: campaigns, isLoading } = useNewsletterCampaigns();
  const deleteCampaign = useDeleteCampaign();

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={campaignsIcon}
        title="Newsletter Campaigns"
        subtitle="Create, send, and measure marketing emails to your subscribers."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
        actions={
          <Link href="/newsletter-campaigns/new">
            <Button type="button" variant="primary">
              <Icon name="add" size={16} /> Create Campaign
            </Button>
          </Link>
        }
      />

      <Card className="flex flex-col gap-4">
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {!isLoading && campaigns && campaigns.length === 0 && (
          <p className="text-sm text-muted">No campaigns yet — create one to get started.</p>
        )}

        {campaigns && campaigns.length > 0 && (
          <div className="overflow-x-auto rounded-inner border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                  <th className="px-3 py-2.5">Campaign</th>
                  <th className="px-3 py-2.5">Status</th>
                  <th className="px-3 py-2.5">Recipients</th>
                  <th className="px-3 py-2.5">Sent</th>
                  <th className="px-3 py-2.5">Opened</th>
                  <th className="px-3 py-2.5">Clicked</th>
                  <th className="px-3 py-2.5">Created</th>
                  <th className="w-16 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr key={c.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5">
                      <Link href={`/newsletter-campaigns/${c.id}`} className="font-semibold text-text hover:text-brand-500">
                        {c.name}
                      </Link>
                      <div className="text-xs text-muted">{c.subject}</div>
                    </td>
                    <td className="px-3 py-2.5">
                      <span className={`rounded-pill px-2.5 py-1 text-xs font-bold ${STATUS_PILL[c.status] ?? "bg-surface-2 text-secondary"}`}>
                        {c.status.replaceAll("_", " ")}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-text">{c.totalRecipients || "—"}</td>
                    <td className="px-3 py-2.5 text-text">{c.totalSent || "—"}</td>
                    <td className="px-3 py-2.5 text-text">{c.totalOpened || "—"}</td>
                    <td className="px-3 py-2.5 text-text">{c.totalClicked || "—"}</td>
                    <td className="px-3 py-2.5 text-muted">{new Date(c.createdAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2.5 text-right">
                      {c.status === "DRAFT" && (
                        <button
                          type="button"
                          aria-label="Delete campaign"
                          onClick={() => {
                            if (confirm(`Delete "${c.name}"?`)) deleteCampaign.mutate(c.id);
                          }}
                          className="text-danger hover:opacity-70"
                        >
                          <Icon name="delete" size={18} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
