"use client";

import Link from "next/link";
import { Button, Card, Icon, PageHeader } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { ProxyApiError } from "@/lib/api/proxy-client";
import { friendlyErrorMessage } from "@/lib/friendly-error";
import { useDeleteTemplate, useDuplicateTemplate, useNewsletterTemplates } from "@/hooks/useNewsletterTemplates";

const templatesIcon = <Icon name="dashboard_customize" />;

export default function NewsletterTemplatesPage() {
  const { data: templates, isLoading } = useNewsletterTemplates();
  const toast = useToast();
  const deleteTemplate = useDeleteTemplate();
  const duplicateTemplate = useDuplicateTemplate();

  async function handleDuplicate(id: number) {
    try {
      await duplicateTemplate.mutateAsync(id);
      toast.push("Template duplicated");
    } catch (err) {
      toast.push(err instanceof ProxyApiError ? friendlyErrorMessage(err.message) : "Failed to duplicate template");
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        icon={templatesIcon}
        title="Newsletter Templates"
        subtitle="Reusable starting points for new campaigns."
        style={{ background: "linear-gradient(135deg, #140A24 0%, #5F03AA 100%)" }}
        actions={
          <Link href="/newsletter-templates/new">
            <Button type="button" variant="primary">
              <Icon name="add" size={16} /> Create Template
            </Button>
          </Link>
        }
      />

      <Card className="flex flex-col gap-4">
        {isLoading && <p className="text-sm text-muted">Loading…</p>}
        {!isLoading && templates && templates.length === 0 && (
          <p className="text-sm text-muted">No templates yet — create one to reuse across campaigns.</p>
        )}

        {templates && templates.length > 0 && (
          <div className="overflow-x-auto rounded-inner border border-border">
            <table className="w-full border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-2 text-xs font-semibold uppercase tracking-wide text-secondary">
                  <th className="px-3 py-2.5">Name</th>
                  <th className="px-3 py-2.5">Updated</th>
                  <th className="w-32 px-3 py-2.5"></th>
                </tr>
              </thead>
              <tbody>
                {templates.map((t) => (
                  <tr key={t.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2.5">
                      <Link href={`/newsletter-templates/${t.id}`} className="font-semibold text-text hover:text-brand-500">
                        {t.name}
                      </Link>
                      {t.description && <div className="text-xs text-muted">{t.description}</div>}
                    </td>
                    <td className="px-3 py-2.5 text-muted">{new Date(t.updatedAt).toLocaleDateString()}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-3">
                        <button
                          type="button"
                          aria-label="Duplicate template"
                          disabled={duplicateTemplate.isPending}
                          onClick={() => handleDuplicate(t.id)}
                          className="text-secondary hover:text-text"
                        >
                          <Icon name="content_copy" size={18} />
                        </button>
                        <button
                          type="button"
                          aria-label="Delete template"
                          onClick={() => {
                            if (confirm(`Delete "${t.name}"?`)) deleteTemplate.mutate(t.id);
                          }}
                          className="text-danger hover:opacity-70"
                        >
                          <Icon name="delete" size={18} />
                        </button>
                      </div>
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
