"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button, Card } from "@amader/admin-ui";
import { SectionConfigFields } from "@/components/homepage-sections/SectionConfigFields";
import { HOMEPAGE_SECTION_TYPES, useCreateHomepageSection, type HomepageSectionType } from "@/hooks/useHomepageSections";
import { sanitizeHomepageSectionConfig } from "@/lib/sanitize-section-config";

export default function NewHomepageSectionPage() {
  const router = useRouter();
  const [type, setType] = useState<HomepageSectionType>("HERO_BANNER");
  const [heading, setHeading] = useState("");
  const [subheading, setSubheading] = useState("");
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [collectionId, setCollectionId] = useState<number | undefined>();
  const create = useCreateHomepageSection();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      type,
      isActive: true,
      sortOrder: 0,
      config: sanitizeHomepageSectionConfig(type, config),
      collectionId,
      translations:
        heading || subheading
          ? [
              { locale: "EN", heading: heading || undefined, subheading: subheading || undefined },
              { locale: "BN", heading: heading || undefined, subheading: subheading || undefined },
            ]
          : undefined,
    });
    router.push("/homepage-sections");
  }

  return (
    <Card className="max-w-2xl">
      <form onSubmit={handleSubmit} className="flex flex-col gap-5">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Section type</span>
          <select
            value={type}
            onChange={(e) => {
              setType(e.target.value as HomepageSectionType);
              setConfig({});
              setCollectionId(undefined);
            }}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          >
            {HOMEPAGE_SECTION_TYPES.map((t) => (
              <option key={t} value={t}>
                {t.replaceAll("_", " ")}
              </option>
            ))}
          </select>
        </label>

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
          type={type}
          config={config}
          onConfigChange={setConfig}
          collectionId={collectionId}
          onCollectionIdChange={setCollectionId}
        />

        <div className="flex gap-3">
          <Button type="submit" variant="primary" disabled={create.isPending}>
            {create.isPending ? "Saving…" : "Create section"}
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
