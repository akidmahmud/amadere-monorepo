"use client";

import { use } from "react";
import { Icon, PageHeader } from "@amader/admin-ui";
import { CampaignEditor } from "@/components/newsletter-campaigns/CampaignEditor";

export default function EditCampaignPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Icon name="campaign" />}
        title="Edit Campaign"
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
      />
      <CampaignEditor campaignId={Number(id)} />
    </div>
  );
}
