"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { SectionConfigFields } from "@/components/homepage-sections/SectionConfigFields";
import { useHomepageSection, useUpdateHomepageSection } from "@/hooks/useHomepageSections";
import { sanitizeHomepageSectionConfig } from "@/lib/sanitize-section-config";

export default function EditHomepageSectionPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const sectionId = Number(id);
  const router = useRouter();
  const { data: section, isLoading } = useHomepageSection(sectionId);
  const update = useUpdateHomepageSection(sectionId);

  const [heading, setHeading] = useState("");
  const [subheading, setSubheading] = useState("");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [collectionId, setCollectionId] = useState<number | undefined>();

  // Section type isn't editable here (changing it would leave the existing
  // config shape stale/mismatched) — only seed local form state once, when
  // the section first loads.
  useEffect(() => {
    if (!section) return;
    setHeading(section.translations[0]?.heading ?? "");
    setSubheading(section.translations[0]?.subheading ?? "");
    setConfig(section.config ?? {});
    setCollectionId(section.collectionId ?? undefined);
  }, [section]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!section) return;
    await update.mutateAsync({
      config: sanitizeHomepageSectionConfig(section.type, config),
      collectionId,
      translations: [
        { locale: "EN", heading: heading || undefined, subheading: subheading || undefined },
        { locale: "BN", heading: heading || undefined, subheading: subheading || undefined },
      ],
    });
    router.push("/homepage-sections");
  }

  if (isLoading || !section) return <p className="text-sm text-muted">Loading…</p>;

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <div>
          <span className="text-xs font-semibold text-secondary">Section type</span>
          <p className="text-sm text-text">{section.type.replaceAll("_", " ")}</p>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Heading (optional)</span>
          <input
            value={heading}
            onChange={(e) => setHeading(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Subheading (optional)</span>
          <input
            value={subheading}
            onChange={(e) => setSubheading(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>

        <SectionConfigFields
          type={section.type}
          config={config}
          onConfigChange={setConfig}
          collectionId={collectionId}
          onCollectionIdChange={setCollectionId}
        />

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={update.isPending}>
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
          <Link href="/homepage-sections">
            <Button type="button" variant="ghost">
              Cancel
            </Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
