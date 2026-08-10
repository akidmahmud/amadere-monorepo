"use client";

import { use } from "react";
import { Icon, PageHeader } from "@amader/admin-ui";
import { TemplateEditor } from "@/components/newsletter-templates/TemplateEditor";

export default function EditTemplatePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Icon name="dashboard_customize" />}
        title="Edit Template"
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
      />
      <TemplateEditor templateId={Number(id)} />
    </div>
  );
}
