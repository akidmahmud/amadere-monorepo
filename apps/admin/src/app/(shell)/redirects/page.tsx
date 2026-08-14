"use client";

import { useMemo, useState } from "react";
import { Button, Card, Icon, Modal, PageHeader, ToggleSwitch } from "@amader/admin-ui";
import {
  useCreateRedirect,
  useDeleteRedirect,
  useRedirects,
  useUpdateRedirect,
  type Redirect,
} from "@/hooks/useRedirects";

const headerStyle = { background: "linear-gradient(135deg, #0B0F19 0%, #1E1B4B 50%, #312E81 100%)" };

const STATUS_CODES = [301, 302, 307, 308] as const;
type StatusCode = (typeof STATUS_CODES)[number];

const STATUS_INFO: Record<StatusCode, { label: string; tag: string; bg: string; text: string; border: string; desc: string }> = {
  301: {
    label: "301 Permanent Redirect",
    tag: "301 Permanent",
    bg: "bg-emerald-600 text-white border-transparent font-extrabold shadow-2xs",
    text: "text-emerald-600",
    border: "border-l-emerald-500",
    desc: "Passes SEO link authority. Use when moving a page permanently.",
  },
  302: {
    label: "302 Found (Temporary)",
    tag: "302 Found",
    bg: "bg-sky-600 text-white border-transparent font-extrabold shadow-2xs",
    text: "text-sky-600",
    border: "border-l-sky-500",
    desc: "Temporary redirect. Search engines maintain indexing of original URL.",
  },
  307: {
    label: "307 Temporary Redirect",
    tag: "307 Temp",
    bg: "bg-amber-600 text-white border-transparent font-extrabold shadow-2xs",
    text: "text-amber-600",
    border: "border-l-amber-500",
    desc: "Temporary redirect preserving original HTTP request method.",
  },
  308: {
    label: "308 Permanent Redirect",
    tag: "308 Permanent",
    bg: "bg-purple-600 text-white border-transparent font-extrabold shadow-2xs",
    text: "text-purple-600",
    border: "border-l-purple-500",
    desc: "Permanent redirect preserving HTTP method & payload body.",
  },
};

function matchesSearch(redirect: Redirect, query: string): boolean {
  if (!query.trim()) return true;
  const q = query.toLowerCase().trim();
  return (
    redirect.fromPath.toLowerCase().includes(q) ||
    redirect.toPath.toLowerCase().includes(q) ||
    String(redirect.id).includes(q) ||
    String(redirect.statusCode).includes(q)
  );
}

interface RedirectModalProps {
  open: boolean;
  onClose: () => void;
  initialData?: Redirect | null;
}

function RedirectFormModal({ open, onClose, initialData }: RedirectModalProps) {
  const [fromPath, setFromPath] = useState(initialData?.fromPath ?? "");
  const [toPath, setToPath] = useState(initialData?.toPath ?? "");
  const [statusCode, setStatusCode] = useState<StatusCode>((initialData?.statusCode as StatusCode) ?? 301);
  const [isActive, setIsActive] = useState(initialData?.isActive ?? true);
  const [error, setError] = useState<string | null>(null);

  const createRedirect = useCreateRedirect();
  const updateRedirect = useUpdateRedirect(initialData?.id ?? 0);

  const isPending = createRedirect.isPending || updateRedirect.isPending;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const formattedFrom = fromPath.trim();
    const formattedTo = toPath.trim();

    if (!formattedFrom || !formattedTo) {
      setError("Both 'From path' and 'To path' are required.");
      return;
    }

    try {
      if (initialData) {
        await updateRedirect.mutateAsync({
          fromPath: formattedFrom,
          toPath: formattedTo,
          statusCode,
          isActive,
        });
      } else {
        await createRedirect.mutateAsync({
          fromPath: formattedFrom,
          toPath: formattedTo,
          statusCode,
          isActive,
        });
      }
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save redirect.");
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={initialData ? "Edit Redirect Rule" : "Add New SEO Redirect"}
      tone="dark"
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-5 pt-1">
        {error && (
          <div className="flex items-center gap-2 rounded-md bg-danger/10 p-3 text-xs font-semibold text-danger border border-danger/20">
            <Icon name="error" size={16} />
            <span>{error}</span>
          </div>
        )}

        {/* Live Preview Card */}
        <div className="rounded-xl border border-border bg-surface-2 p-4 shadow-2xs">
          <span className="text-[11px] font-bold uppercase tracking-wider text-muted block mb-2">Live Redirect Preview</span>
          <div className="flex items-center gap-2 text-xs font-mono font-medium overflow-x-auto pb-1">
            <span className="rounded bg-surface px-2.5 py-1 text-text border border-border shrink-0">
              {fromPath || "/old-path"}
            </span>
            <Icon name="arrow_forward" size={14} className="text-brand-500 shrink-0" />
            <span className="rounded bg-surface px-2.5 py-1 text-brand-600 font-bold border border-brand-200 shrink-0">
              {toPath || "/new-path"}
            </span>
            <span className={`ml-auto rounded-full px-2.5 py-0.5 text-[10px] font-extrabold border shrink-0 ${STATUS_INFO[statusCode].bg}`}>
              {statusCode}
            </span>
          </div>
          <p className="text-[11px] text-muted mt-2">{STATUS_INFO[statusCode].desc}</p>
        </div>

        {/* Inputs */}
        <div className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-secondary">From Path (Source URL pattern)</span>
            <input
              required
              type="text"
              value={fromPath}
              onChange={(e) => setFromPath(e.target.value)}
              placeholder="/old-category/old-product-slug"
              className="h-10 rounded-lg border border-border bg-surface px-3.5 text-sm text-text font-mono outline-none focus:border-brand-500 transition-colors"
            />
            <span className="text-[11px] text-muted">Original URI path to be intercepted and redirected.</span>
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-xs font-bold text-secondary">To Path (Target URL destination)</span>
            <input
              required
              type="text"
              value={toPath}
              onChange={(e) => setToPath(e.target.value)}
              placeholder="/products/new-product-slug"
              className="h-10 rounded-lg border border-border bg-surface px-3.5 text-sm text-text font-mono outline-none focus:border-brand-500 transition-colors"
            />
            <span className="text-[11px] text-muted">Destination path or external URL users and crawlers will reach.</span>
          </label>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-end">
            <label className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-secondary">HTTP Status Code</span>
              <select
                value={statusCode}
                onChange={(e) => setStatusCode(Number(e.target.value) as StatusCode)}
                className="h-10 rounded-lg border border-border bg-surface px-3.5 text-sm text-text font-semibold outline-none focus:border-brand-500 transition-colors"
              >
                {STATUS_CODES.map((code) => (
                  <option key={code} value={code}>
                    {STATUS_INFO[code].label}
                  </option>
                ))}
              </select>
            </label>

            <div className="flex items-center justify-between h-10 px-3.5 rounded-lg border border-border bg-surface">
              <span className="text-xs font-bold text-secondary">Active Status</span>
              <ToggleSwitch checked={isActive} onChange={setIsActive} label={isActive ? "Active" : "Disabled"} />
            </div>
          </div>
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-3 pt-3 border-t border-border mt-2">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={isPending} className="gap-2 px-5">
            <Icon name={initialData ? "save" : "add"} size={16} />
            <span>{isPending ? "Saving…" : initialData ? "Save Changes" : "Create Redirect"}</span>
          </Button>
        </div>
      </form>
    </Modal>
  );
}

function RedirectRowItem({
  redirect,
  onEdit,
  onCopy,
  copied,
}: {
  redirect: Redirect;
  onEdit: (r: Redirect) => void;
  onCopy: (r: Redirect) => void;
  copied: boolean;
}) {
  const updateRedirect = useUpdateRedirect(redirect.id);
  const deleteRedirect = useDeleteRedirect();
  const statusCfg = STATUS_INFO[(redirect.statusCode as StatusCode) ?? 301];

  return (
    <Card
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-l-4 ${statusCfg.border} hover:border-brand-500/40 hover:shadow-xs transition-all`}
    >
      <div className="flex flex-wrap items-center gap-2.5 min-w-0 flex-1">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold border ${statusCfg.bg}`}>
          {redirect.statusCode}
        </span>

        <span
          className="font-mono text-xs font-semibold text-text rounded-md bg-surface-2 px-2.5 py-1 border border-border max-w-[220px] md:max-w-xs truncate"
          title={redirect.fromPath}
        >
          {redirect.fromPath}
        </span>

        <Icon name="arrow_forward" size={16} className="text-muted shrink-0" />

        <span
          className="font-mono text-xs font-bold text-brand-600 rounded-md bg-brand-50 dark:bg-brand-950/40 px-2.5 py-1 border border-brand-200 dark:border-brand-800 max-w-[220px] md:max-w-xs truncate"
          title={redirect.toPath}
        >
          {redirect.toPath}
        </span>
      </div>

      <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-border">
        <ToggleSwitch
          checked={redirect.isActive}
          onChange={(checked) => updateRedirect.mutate({ isActive: checked })}
          label={redirect.isActive ? "Active" : "Disabled"}
        />

        <div className="flex items-center gap-1.5 pl-2 border-l border-border">
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs font-semibold gap-1 text-secondary"
            onClick={() => onCopy(redirect)}
            title="Copy redirect pair"
          >
            <Icon name={copied ? "check" : "content_copy"} size={14} />
            <span>{copied ? "Copied" : "Copy"}</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs font-semibold gap-1"
            onClick={() => onEdit(redirect)}
            title="Edit redirect"
          >
            <Icon name="edit" size={14} />
            <span>Edit</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs text-danger hover:bg-danger/10"
            onClick={() => {
              if (confirm(`Delete redirect rule ${redirect.fromPath} → ${redirect.toPath}?`)) {
                deleteRedirect.mutate(redirect.id);
              }
            }}
            title="Delete redirect"
          >
            <Icon name="delete" size={14} />
          </Button>
        </div>
      </div>
    </Card>
  );
}

function RedirectGridItem({
  redirect,
  onEdit,
  onCopy,
  copied,
}: {
  redirect: Redirect;
  onEdit: (r: Redirect) => void;
  onCopy: (r: Redirect) => void;
  copied: boolean;
}) {
  const updateRedirect = useUpdateRedirect(redirect.id);
  const deleteRedirect = useDeleteRedirect();
  const statusCfg = STATUS_INFO[(redirect.statusCode as StatusCode) ?? 301];

  return (
    <Card
      className={`flex flex-col justify-between gap-4 p-5 border-t-4 ${statusCfg.border} hover:border-brand-500/40 hover:shadow-xs transition-all`}
    >
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-extrabold border ${statusCfg.bg}`}>
            {statusCfg.tag}
          </span>
          <ToggleSwitch
            checked={redirect.isActive}
            onChange={(checked) => updateRedirect.mutate({ isActive: checked })}
          />
        </div>

        <div className="flex flex-col gap-2 rounded-lg bg-surface-2 p-3 border border-border">
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">From Source</span>
            <span className="font-mono text-xs font-semibold text-text truncate" title={redirect.fromPath}>
              {redirect.fromPath}
            </span>
          </div>
          <div className="flex justify-center my-0.5">
            <Icon name="arrow_downward" size={14} className="text-brand-500" />
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">To Destination</span>
            <span className="font-mono text-xs font-bold text-brand-600 truncate" title={redirect.toPath}>
              {redirect.toPath}
            </span>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 pt-3 border-t border-border mt-auto">
        <span className="text-[11px] font-mono text-muted">Rule #{redirect.id}</span>
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs text-secondary"
            onClick={() => onCopy(redirect)}
          >
            <Icon name={copied ? "check" : "content_copy"} size={14} />
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs font-semibold"
            onClick={() => onEdit(redirect)}
          >
            Edit
          </Button>
          <Button
            type="button"
            variant="ghost"
            className="h-8 px-2 text-xs text-danger hover:bg-danger/10"
            onClick={() => {
              if (confirm(`Delete redirect rule ${redirect.fromPath} → ${redirect.toPath}?`)) {
                deleteRedirect.mutate(redirect.id);
              }
            }}
          >
            Delete
          </Button>
        </div>
      </div>
    </Card>
  );
}

export default function RedirectsPage() {
  const { data: redirects, isLoading } = useRedirects();

  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [activeFilter, setActiveFilter] = useState<string>("ALL");
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingRedirect, setEditingRedirect] = useState<Redirect | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);

  // Compute Metrics
  const totalCount = redirects?.length ?? 0;
  const activeCount = useMemo(() => redirects?.filter((r) => r.isActive).length ?? 0, [redirects]);
  const permCount = useMemo(() => redirects?.filter((r) => r.statusCode === 301 || r.statusCode === 308).length ?? 0, [redirects]);
  const tempCount = useMemo(() => redirects?.filter((r) => r.statusCode === 302 || r.statusCode === 307).length ?? 0, [redirects]);

  // Filtered Redirects List
  const filteredRedirects = useMemo(() => {
    if (!redirects) return [];
    return redirects.filter((r) => {
      if (statusFilter !== "ALL" && String(r.statusCode) !== statusFilter) return false;
      if (activeFilter === "ACTIVE" && !r.isActive) return false;
      if (activeFilter === "INACTIVE" && r.isActive) return false;
      return matchesSearch(r, searchQuery);
    });
  }, [redirects, statusFilter, activeFilter, searchQuery]);

  function handleOpenCreate() {
    setEditingRedirect(null);
    setModalOpen(true);
  }

  function handleOpenEdit(redirect: Redirect) {
    setEditingRedirect(redirect);
    setModalOpen(true);
  }

  function handleCopy(redirect: Redirect) {
    const text = `${redirect.fromPath} -> ${redirect.toPath}`;
    navigator.clipboard.writeText(text);
    setCopiedId(redirect.id);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Hero Page Header */}
      <PageHeader
        icon={<Icon name="alt_route" />}
        title="SEO & Dynamic Redirect Rules"
        subtitle="Manage 301, 302, 307, and 308 URL redirects to maintain search rankings and fix broken links seamlessly."
        style={headerStyle}
        actions={
          <Button variant="primary" onClick={handleOpenCreate} className="gap-2 shadow-sm">
            <Icon name="add" size={18} />
            <span>Add Redirect</span>
          </Button>
        }
      />

      {/* Metric Cards KPI Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="flex items-center gap-3.5 border-l-4 border-l-brand-500">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-brand-50 text-brand-500 dark:bg-brand-950/40">
            <Icon name="swap_horiz" size={22} />
          </div>
          <div>
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Total Rules</span>
            <p className="text-2xl font-extrabold text-text mt-0.5">{totalCount}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 border-l-4 border-l-emerald-500">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-emerald-50 text-emerald-600 dark:bg-emerald-950/40">
            <Icon name="check_circle" size={22} />
          </div>
          <div>
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Active Rules</span>
            <p className="text-2xl font-extrabold text-text mt-0.5">{activeCount}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 border-l-4 border-l-indigo-500">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40">
            <Icon name="link" size={22} />
          </div>
          <div>
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Permanent (301/308)</span>
            <p className="text-2xl font-extrabold text-text mt-0.5">{permCount}</p>
          </div>
        </Card>

        <Card className="flex items-center gap-3.5 border-l-4 border-l-amber-500">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-600 dark:bg-amber-950/40">
            <Icon name="schedule" size={22} />
          </div>
          <div>
            <span className="text-xs font-bold text-muted uppercase tracking-wider">Temporary (302/307)</span>
            <p className="text-2xl font-extrabold text-text mt-0.5">{tempCount}</p>
          </div>
        </Card>
      </div>

      {/* Toolbar with Searchbar & Filters */}
      <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 rounded-xl border border-border bg-surface p-4 shadow-xs">
        {/* Real-time Fuzzy Search Bar */}
        <div className="relative w-full lg:w-96 shrink-0">
          <Icon name="search" size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search redirects by source or target path…"
            className="h-10 w-full rounded-lg border border-border bg-surface pl-10 pr-9 text-sm text-text font-ui outline-none focus:border-brand-500 transition-colors placeholder:text-muted"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-text p-1 transition-colors"
              title="Clear search"
            >
              <Icon name="close" size={15} />
            </button>
          )}
        </div>

        {/* Filter Controls & Layout Toggles */}
        <div className="flex flex-wrap items-center justify-between lg:justify-end gap-3 w-full lg:w-auto">
          {/* Status Code Filter */}
          <div className="flex items-center rounded-lg bg-surface-2 p-1 border border-border">
            <span className="text-[11px] font-bold text-muted px-2 hidden sm:inline uppercase">Code:</span>
            {["ALL", "301", "302", "307", "308"].map((code) => (
              <button
                key={code}
                type="button"
                onClick={() => setStatusFilter(code)}
                className={`rounded-md px-2.5 py-1 text-xs font-extrabold transition-all ${
                  statusFilter === code ? "bg-surface text-brand-600 shadow-2xs" : "text-muted hover:text-text"
                }`}
              >
                {code}
              </button>
            ))}
          </div>

          {/* Active Status Filter */}
          <div className="flex items-center rounded-lg bg-surface-2 p-1 border border-border">
            {["ALL", "ACTIVE", "INACTIVE"].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setActiveFilter(st)}
                className={`rounded-md px-2.5 py-1 text-xs font-bold transition-all ${
                  activeFilter === st ? "bg-surface text-brand-600 shadow-2xs" : "text-muted hover:text-text"
                }`}
              >
                {st === "ALL" ? "All Status" : st.charAt(0) + st.slice(1).toLowerCase()}
              </button>
            ))}
          </div>

          {/* View Mode Toggle */}
          <div className="flex rounded-lg bg-surface-2 p-1 border border-border shrink-0">
            <button
              type="button"
              onClick={() => setViewMode("list")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "list" ? "bg-surface text-brand-600 shadow-2xs" : "text-muted"}`}
              title="List view"
            >
              <Icon name="format_list_bulleted" size={16} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("grid")}
              className={`p-1.5 rounded-md transition-colors ${viewMode === "grid" ? "bg-surface text-brand-600 shadow-2xs" : "text-muted"}`}
              title="Grid view"
            >
              <Icon name="grid_view" size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Loading Skeleton */}
      {isLoading && (
        <div className="flex h-56 flex-col items-center justify-center rounded-2xl border border-border bg-surface gap-3">
          <Icon name="progress_activity" className="animate-spin text-brand-500" size={24} />
          <span className="text-sm font-semibold text-muted">Loading redirect rules…</span>
        </div>
      )}

      {/* Empty State */}
      {!isLoading && filteredRedirects.length === 0 && (
        <Card className="flex flex-col items-center justify-center gap-3 py-14 text-center border-dashed border-2">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-brand-50 text-brand-500 dark:bg-brand-950/40">
            <Icon name="alt_route" size={28} />
          </div>
          <div>
            <h3 className="text-base font-bold text-text">No Redirect Rules Found</h3>
            <p className="text-xs text-muted mt-1 max-w-sm">
              {searchQuery
                ? `No redirects matching "${searchQuery}". Try clearing search or adjusting your status filters.`
                : "No URL redirects configured yet. Click below to add your first redirect rule."}
            </p>
          </div>
          {searchQuery ? (
            <Button variant="ghost" onClick={() => setSearchQuery("")} className="mt-2 text-xs">
              Clear Search Query
            </Button>
          ) : (
            <Button variant="primary" onClick={handleOpenCreate} className="mt-2 gap-2">
              <Icon name="add" size={16} />
              <span>Create First Redirect</span>
            </Button>
          )}
        </Card>
      )}

      {/* Redirect Rules Presentation */}
      {!isLoading && filteredRedirects.length > 0 && (
        viewMode === "list" ? (
          <div className="flex flex-col gap-3">
            {filteredRedirects.map((r) => (
              <RedirectRowItem
                key={r.id}
                redirect={r}
                onEdit={handleOpenEdit}
                onCopy={handleCopy}
                copied={copiedId === r.id}
              />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredRedirects.map((r) => (
              <RedirectGridItem
                key={r.id}
                redirect={r}
                onEdit={handleOpenEdit}
                onCopy={handleCopy}
                copied={copiedId === r.id}
              />
            ))}
          </div>
        )
      )}

      {/* Create / Edit Form Modal */}
      {modalOpen && (
        <RedirectFormModal
          open={modalOpen}
          onClose={() => setModalOpen(false)}
          initialData={editingRedirect}
        />
      )}
    </div>
  );
}
