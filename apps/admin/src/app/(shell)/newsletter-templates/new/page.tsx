"use client";

import { Icon, PageHeader } from "@amader/admin-ui";
import { TemplateEditor } from "@/components/newsletter-templates/TemplateEditor";

export default function NewTemplatePage() {
  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={<Icon name="dashboard_customize" />}
        title="Create Template"
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
      />
      <TemplateEditor templateId={null} />
    </div>
  );
}
