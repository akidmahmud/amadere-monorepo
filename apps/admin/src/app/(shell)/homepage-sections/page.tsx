"use client";

import { useState } from "react";
import Link from "next/link";
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors, type DragEndEvent } from "@dnd-kit/core";
import { SortableContext, arrayMove, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Button, Card, Icon, PageHeader, ToggleSwitch } from "@amader/admin-ui";
import {
  useDeleteHomepageSection,
  useHomepageSections,
  useReorderHomepageSections,
  useUpdateHomepageSection,
  type AdminHomepageSection,
  type HomepageSectionType,
} from "@/hooks/useHomepageSections";

const headerStyle = { background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)" };

const SECTION_TYPE_ICONS: Record<HomepageSectionType, string> = {
  HERO_BANNER: "view_carousel",
  HOME_BANNER_TWO: "slideshow",
  BANNER_STRIP: "image",
  AD_BANNER: "campaign",
  PRODUCT_COLLECTION: "grid_view",
  CATEGORY_SHOWCASE: "category",
  FEATURED_CATEGORIES: "category",
  TOP_SELLING_PRODUCTS: "star",
  JUST_FOR_YOU: "thumb_up",
  FEATURED_DEALS: "sell",
  BLOG_TEASER: "article",
  TESTIMONIAL_BENTO: "reviews",
  CERTIFICATION_ROW: "verified",
  CIRCLE_BADGE_BAR: "stars",
  TABBED_COLLECTION_CAROUSEL: "tab",
};

function SectionRow({ section, index }: { section: AdminHomepageSection; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: section.id });
  const updateSection = useUpdateHomepageSection(section.id);
  const deleteSection = useDeleteHomepageSection();
  
  const bnHeading = section.translations.find((t) => (t as unknown as { locale?: string }).locale === "BN")?.heading;
  const enHeading = section.translations.find((t) => (t as unknown as { locale?: string }).locale === "EN")?.heading;
  const heading = bnHeading || enHeading || section.translations[0]?.heading;
  const subheading = section.translations[0]?.subheading;

  const iconName = SECTION_TYPE_ICONS[section.type] || "view_quilt";

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.4 : 1 }}
    >
      <Card
        className={`flex items-center gap-4 transition-all duration-200 border-2 ${
          isDragging ? "border-brand-500 shadow-md bg-brand-50/20" : "border-border hover:border-brand-500/40 hover:shadow-xs"
        }`}
      >
        {/* Drag handle */}
        <button
          {...attributes}
          {...listeners}
          type="button"
          aria-label="Drag to reorder section position"
          className="cursor-grab touch-none p-1 text-muted hover:text-brand-500 transition-colors"
        >
          <Icon name="drag_indicator" size={20} />
        </button>

        {/* Position Number Pill */}
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-sm bg-surface-2 text-xs font-bold text-secondary font-mono border border-border">
          #{index + 1}
        </span>

        {/* Section Type Icon Circle */}
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-inner bg-brand-50 text-brand-500 overflow-hidden text-[0px] select-none">
          <Icon name={iconName} size={20} />
        </div>

        {/* Section Title & Metadata */}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h4 className="truncate text-sm font-bold text-text">
              {heading || <span className="italic text-muted font-normal">Untitled Section</span>}
            </h4>
            <span className="rounded-sm bg-surface-2 px-2 py-0.5 font-mono text-[10px] font-bold text-muted border border-border">
              {section.type.replaceAll("_", " ")}
            </span>
          </div>

          {subheading ? (
            <p className="truncate text-xs text-muted mt-0.5">{subheading}</p>
          ) : (
            <p className="text-[11px] text-muted/70 mt-0.5">Section #{section.id}</p>
          )}
        </div>

        {/* Status Switch Toggle */}
        <div className="flex items-center gap-2 pr-2 border-r border-border">
          <ToggleSwitch
            checked={section.isActive}
            onChange={(v) => updateSection.mutate({ isActive: v })}
            label=""
          />
          <span
            className={`text-xs font-semibold hidden sm:inline-block ${
              section.isActive ? "text-emerald-600" : "text-muted"
            }`}
          >
            {section.isActive ? "Active" : "Hidden"}
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2">
          <Link href={`/homepage-sections/${section.id}`}>
            <Button type="button" variant="ghost" className="h-9 px-3 text-xs font-bold">
              <Icon name="edit" size={15} />
              <span>Edit</span>
            </Button>
          </Link>
          <Button
            type="button"
            variant="ghost"
            className="h-9 px-2 text-xs text-danger hover:bg-danger/5"
            onClick={() => {
              if (confirm("Delete this section? This cannot be undone.")) deleteSection.mutate(section.id);
            }}
          >
            <Icon name="delete" size={15} />
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function HomepageSectionsPage() {
  const { data: sections, isLoading } = useHomepageSections();
  const reorder = useReorderHomepageSections();
  const [dragOrder, setDragOrder] = useState<number[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const rawList = dragOrder
    ? (dragOrder.map((id) => sections?.find((s) => s.id === id)).filter(Boolean) as AdminHomepageSection[])
    : sections;

  const filteredSections = rawList?.filter((s) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    const heading = (s.translations[0]?.heading || "").toLowerCase();
    const type = s.type.replaceAll("_", " ").toLowerCase();
    return heading.includes(query) || type.includes(query);
  });

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (!over || active.id === over.id || !sections) return;
    const ids = sections.map((s) => s.id);
    const oldIndex = ids.indexOf(active.id as number);
    const newIndex = ids.indexOf(over.id as number);
    const newOrder = arrayMove(ids, oldIndex, newIndex);
    setDragOrder(newOrder);
    reorder.mutate(newOrder);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Header */}
      <PageHeader
        icon={<Icon name="grid_view" />}
        title="Homepage Layout Builder"
        subtitle="Organize, curate, and drag to reorder top-to-bottom sections on your storefront homepage."
        style={headerStyle}
      />

      {/* Control Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs">
        {/* Search Input */}
        <div className="relative w-full sm:w-80">
          <Icon name="search" size={18} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search by section name or type…"
            className="h-10 w-full rounded-sm border border-border bg-surface pl-9 pr-3 text-sm text-text outline-none focus:border-brand-500 transition-colors"
          />
        </div>

        {/* Counter & Add Section Button */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
          <span className="text-xs font-semibold text-secondary">
            {sections ? `${sections.length} ${sections.length === 1 ? "Section" : "Sections"}` : "Loading…"}
          </span>
          <Link href="/homepage-sections/new">
            <Button variant="primary" className="gap-2">
              <Icon name="add" size={16} />
              <span>Add Section</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Loading State */}
      {isLoading && (
        <div className="flex h-48 items-center justify-center rounded-2xl border border-border bg-surface">
          <div className="flex items-center gap-3 text-sm text-muted">
            <Icon name="progress_activity" className="animate-spin" size={20} />
            <span>Loading homepage layout…</span>
          </div>
        </div>
      )}

      {/* Empty State */}
      {filteredSections && filteredSections.length === 0 && (
        <Card className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <div className="grid h-12 w-12 place-items-center rounded-full bg-brand-50 text-brand-500">
            <Icon name="view_quilt" size={24} />
          </div>
          <div>
            <h3 className="text-base font-bold text-text">No Sections Found</h3>
            <p className="text-xs text-muted mt-1">
              {searchQuery ? "No sections match your search query." : "Add homepage sections to populate your storefront layout."}
            </p>
          </div>
          <Link href="/homepage-sections/new" className="mt-2">
            <Button variant="primary">Add First Section</Button>
          </Link>
        </Card>
      )}

      {/* Draggable List */}
      {filteredSections && filteredSections.length > 0 && (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={filteredSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-3">
              {filteredSections.map((section, idx) => (
                <SectionRow key={section.id} section={section} index={idx} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}
