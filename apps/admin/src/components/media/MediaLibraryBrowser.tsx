"use client";

import { useMemo, useRef, useState, type ReactNode } from "react";
import {
  useCreateMediaFolder,
  useDeleteMediaFolder,
  useMediaFolders,
  useMediaLibrary,
  useMoveMediaToFolder,
  useUploadMedia,
} from "@/hooks/useMedia";
import type { components } from "@/lib/api/schema";
import { MediaDetailsPanel } from "./MediaDetailsPanel";
import { mediaDisplayName, mediaExtension } from "@/lib/media-name";

type MediaDto = components["schemas"]["MediaDto"];
type MediaFolderDto = components["schemas"]["MediaFolderDto"];

const MEDIA_ID_DND_TYPE = "application/x-amader-media-id";

/* --- SVG Icons --- */
const folderIcon = (
  <svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2z" />
  </svg>
);

const uploadCloudIcon = (
  <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth={1.75} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 14.899A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
    <path d="M12 12v9" />
    <path d="m16 16-4-4-4 4" />
  </svg>
);

const backIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 12H5M12 19l-7-7 7-7" />
  </svg>
);

const trashIcon = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

const searchIcon = (
  <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

const gridIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="3" width="7" height="7" rx="1.5" />
    <rect x="14" y="14" width="7" height="7" rx="1.5" />
    <rect x="3" y="14" width="7" height="7" rx="1.5" />
  </svg>
);

const listIcon = (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

export interface MediaLibraryBrowserProps {
  /** Picker mode: clicking a media item calls this instead of just viewing it. */
  onSelect?: (media: MediaDto) => void;
  /** Multi-select indicator */
  isSelected?: (media: MediaDto) => boolean;
  /** Management extras rendered per item */
  renderItemActions?: (media: MediaDto) => ReactNode;
  isModal?: boolean;
}

export function MediaLibraryBrowser({ onSelect, isSelected, renderItemActions, isModal }: MediaLibraryBrowserProps) {
  const inModal = isModal ?? Boolean(onSelect);
  const [folderId, setFolderId] = useState<number | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [detailsItem, setDetailsItem] = useState<MediaDto | null>(null);

  // New UX state: search, type filter, grid/list view mode
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<"ALL" | "IMAGE" | "VIDEO">("ALL");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");

  const { data: folders } = useMediaFolders();
  const { data: media, isLoading } = useMediaLibrary(folderId === null ? { unfiled: true } : { folderId });
  const upload = useUploadMedia();
  const moveMedia = useMoveMediaToFolder();
  const createFolder = useCreateMediaFolder();
  const deleteFolder = useDeleteMediaFolder();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFolder = folders?.find((f) => f.id === folderId);

  /**
   * Ancestors of the open folder, root first, for the breadcrumb.
   *
   * Built client-side from the flat list the endpoint already returns rather
   * than adding a "path" route — there are only ever a handful of folders,
   * and one source of truth beats two. The visited guard stops a malformed
   * parent chain (a cycle introduced by hand in the database) from hanging
   * the admin.
   */
  const breadcrumb = useMemo(() => {
    if (!folders || folderId === null) return [];
    const byId = new Map(folders.map((f) => [f.id, f]));
    const path: typeof folders = [];
    const seen = new Set<number>();
    let node = byId.get(folderId);
    while (node && !seen.has(node.id)) {
      seen.add(node.id);
      path.unshift(node);
      node = node.parentId === null ? undefined : byId.get(node.parentId);
    }
    return path;
  }, [folders, folderId]);

  /** Subfolders of wherever we are — root shows the top-level ones. */
  const childFolders = useMemo(
    () => (folders ?? []).filter((f) => (f.parentId ?? null) === folderId),
    [folders, folderId],
  );

  async function uploadFiles(files: File[], targetFolderId: number | null) {
    for (const file of files) {
      const item = await upload.mutateAsync(file);
      if (targetFolderId !== null) moveMedia.mutate({ id: item.id, folderId: targetFolderId });
    }
  }

  function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    // Nests under whatever is open; at the root this is null, i.e. top level.
    createFolder.mutate(
      { name, parentId: folderId },
      { onSuccess: () => setNewFolderName("") },
    );
    setCreatingFolder(false);
  }

  // Filtered media list
  const filteredMedia = useMemo(() => {
    if (!media) return [];
    return media.filter((item) => {
      // Type filter
      if (filterType === "IMAGE" && item.type !== "IMAGE") return false;
      if (filterType === "VIDEO" && item.type !== "VIDEO") return false;
      // Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = mediaDisplayName(item.url).toLowerCase();
        const alt = (item.altText ?? "").toLowerCase();
        if (!name.includes(q) && !alt.includes(q)) return false;
      }
      return true;
    });
  }, [media, filterType, searchQuery]);

  return (
    <div className="flex items-start gap-5 w-full">
      <div className="flex min-w-0 flex-1 flex-col gap-4">
        {/* --- Top Navigation & Action Toolbar --- */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/70 bg-surface-2/60 p-3 backdrop-blur-sm">
          {/* Breadcrumbs & Folder Navigation */}
          <div className="flex items-center gap-2 text-sm font-semibold">
            {currentFolder && (
              <button
                type="button"
                // Up one level, not straight to the root — with nesting,
                // jumping to All Media from three levels deep loses your place.
                onClick={() => setFolderId(currentFolder?.parentId ?? null)}
                aria-label="Up one folder"
                className="flex h-7 w-7 items-center justify-center rounded-lg border border-border/80 bg-surface text-text shadow-sm hover:bg-surface-2 transition-all"
              >
                {backIcon}
              </button>
            )}
            <button
              type="button"
              onClick={() => setFolderId(null)}
              className={
                folderId === null
                  ? "font-bold text-brand-600"
                  : "text-secondary hover:text-brand-600 transition-colors"
              }
            >
              All Media
            </button>
            {breadcrumb.map((f, i) => (
              <span key={f.id} className="flex items-center gap-2">
                <span className="text-muted">/</span>
                {i === breadcrumb.length - 1 ? (
                  <span className="font-bold text-text">{f.name}</span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setFolderId(f.id)}
                    className="text-secondary transition-colors hover:text-brand-600"
                  >
                    {f.name}
                  </button>
                )}
              </span>
            ))}
          </div>

          {/* Controls: Search, Type Filter, View Switcher, New Folder */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative flex items-center">
              <span className="absolute left-2.5 text-muted pointer-events-none">{searchIcon}</span>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search files…"
                className="h-8.5 w-40 sm:w-48 rounded-xl border border-border/80 bg-surface pl-8 pr-3 text-xs text-text placeholder-muted outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 transition-all"
              />
            </div>

            {/* Type Filter Buttons */}
            <div className="flex items-center rounded-xl border border-border/80 bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setFilterType("ALL")}
                className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                  filterType === "ALL" ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-text"
                }`}
              >
                All
              </button>
              <button
                type="button"
                onClick={() => setFilterType("IMAGE")}
                className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                  filterType === "IMAGE" ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-text"
                }`}
              >
                Images
              </button>
              <button
                type="button"
                onClick={() => setFilterType("VIDEO")}
                className={`h-7 px-2.5 rounded-lg text-xs font-semibold transition-all ${
                  filterType === "VIDEO" ? "bg-brand-500 text-white shadow-sm" : "text-muted hover:text-text"
                }`}
              >
                Videos
              </button>
            </div>

            {/* View Mode Toggle */}
            <div className="flex items-center rounded-xl border border-border/80 bg-surface p-0.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                title="Grid view"
                className={`grid h-7 w-7 place-items-center rounded-lg transition-all ${
                  viewMode === "grid" ? "bg-surface-2 text-brand-600 shadow-sm" : "text-muted hover:text-text"
                }`}
              >
                {gridIcon}
              </button>
              <button
                type="button"
                onClick={() => setViewMode("list")}
                title="List view"
                className={`grid h-7 w-7 place-items-center rounded-lg transition-all ${
                  viewMode === "list" ? "bg-surface-2 text-brand-600 shadow-sm" : "text-muted hover:text-text"
                }`}
              >
                {listIcon}
              </button>
            </div>

            {/* Create Folder Button / Input.
                NOT gated on being at the root: it creates inside whatever is
                open (handleCreateFolder passes the current folderId as the
                parent), so hiding it inside a folder made subfolders
                impossible to create from the UI. */}
            {creatingFolder ? (
                <div className="flex items-center gap-1.5">
                  <input
                    autoFocus
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleCreateFolder();
                      if (e.key === "Escape") setCreatingFolder(false);
                    }}
                    placeholder="Folder name"
                    className="h-8.5 rounded-xl border border-brand-500 bg-surface px-3 text-xs text-text outline-none shadow-sm"
                  />
                  <button
                    type="button"
                    onClick={handleCreateFolder}
                    className="h-8.5 rounded-xl bg-brand-500 px-3 text-xs font-bold text-white shadow-sm hover:bg-brand-600 active:scale-95 transition-all"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreatingFolder(false)}
                    className="h-8.5 rounded-xl px-2.5 text-xs font-semibold text-muted hover:bg-surface transition-all"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setCreatingFolder(true)}
                  className="inline-flex h-8.5 items-center gap-1.5 rounded-xl border border-border/80 bg-surface px-3 text-xs font-bold text-text shadow-sm hover:bg-surface-2 hover:border-brand-500/50 transition-all"
              >
                {folderId === null ? "+ New Folder" : "+ New Subfolder"}
              </button>
            )}
          </div>
        </div>

        {/* --- Modern Drag & Drop Upload Zone --- */}
        <div
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDropzoneActive(true);
          }}
          onDragLeave={() => setDropzoneActive(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDropzoneActive(false);
            const files = Array.from(e.dataTransfer.files);
            if (files.length) uploadFiles(files, folderId);
          }}
          className={`group relative flex flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-5 text-center cursor-pointer transition-all duration-200 ${
            dropzoneActive
              ? "border-brand-500 bg-brand-50/70 scale-[1.005] shadow-md"
              : "border-border/90 bg-surface-2/40 hover:border-brand-500/80 hover:bg-surface-2/80 hover:shadow-sm"
          }`}
        >
          <div
            className={`grid h-12 w-12 place-items-center rounded-2xl transition-all duration-200 ${
              dropzoneActive
                ? "bg-brand-500 text-white scale-110 shadow-lg"
                : "bg-surface border border-border/80 text-brand-500 shadow-sm group-hover:scale-110 group-hover:bg-brand-500 group-hover:text-white"
            }`}
          >
            {uploadCloudIcon}
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="text-xs font-bold text-text">
              {upload.isPending ? (
                <span className="animate-pulse text-brand-600">Uploading files to library…</span>
              ) : (
                <>
                  <span className="text-brand-600 hover:underline">Click to upload</span> or drag and drop files here
                </>
              )}
            </span>
            <span className="text-[11px] font-medium text-muted">
              Supported formats: PNG, JPG, WEBP, SVG, MP4 (auto-compressed for web)
            </span>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            hidden
            onChange={(e) => {
              const files = Array.from(e.target.files ?? []);
              e.target.value = "";
              if (files.length) uploadFiles(files, folderId);
            }}
          />
        </div>

        {/* --- Folder List Grid --- */}
        {childFolders.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-muted px-1">
              {folderId === null ? "Folders" : "Subfolders"}
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {childFolders.map((f) => (
                <FolderTile
                  key={f.id}
                  folder={f}
                  dragOver={dragOverFolderId === f.id}
                  onOpen={() => setFolderId(f.id)}
                  onDelete={() => {
                    const kids = (folders ?? []).filter((x) => x.parentId === f.id).length;
                    const warning = kids > 0
                      ? `Delete folder "${f.name}" and its ${kids} subfolder(s)? Media inside stays as unfiled.`
                      : `Delete folder "${f.name}"? Media inside stays as unfiled.`;
                    if (confirm(warning)) deleteFolder.mutate(f.id);
                  }}
                  onDragOver={() => setDragOverFolderId(f.id)}
                  onDragLeave={() => setDragOverFolderId(null)}
                  onDropFiles={(files) => uploadFiles(files, f.id)}
                  onDropMediaId={(id) => moveMedia.mutate({ id, folderId: f.id })}
                />
              ))}
            </div>
          </div>
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="flex flex-col items-center justify-center p-12 text-center text-muted gap-2">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
            <span className="text-xs font-medium">Loading media library…</span>
          </div>
        )}

        {/* Empty State */}
        {!isLoading && filteredMedia.length === 0 && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/80 bg-surface-2/30 p-12 text-center gap-2">
            <div className="grid h-12 w-12 place-items-center rounded-full bg-surface-2 text-muted">
              {searchQuery ? searchIcon : gridIcon}
            </div>
            <p className="text-xs font-bold text-text">
              {searchQuery ? `No files matching "${searchQuery}"` : "No media files found"}
            </p>
            <p className="text-[11px] text-muted max-w-xs">
              {searchQuery ? "Try searching for a different keyword or file name." : "Drag & drop images above or click upload to add media."}
            </p>
          </div>
        )}

        {/* --- Media Items View: Grid Mode --- */}
        {!isLoading && filteredMedia.length > 0 && viewMode === "grid" && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3.5">
            {filteredMedia.map((item) => {
              const selected = isSelected?.(item) ?? false;
              const ext = (mediaExtension(item.url) || item.type || "").toUpperCase();

              return (
                <div
                  key={item.id}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData(MEDIA_ID_DND_TYPE, String(item.id))}
                  className={`group relative flex flex-col gap-2 rounded-2xl border bg-surface p-2 transition-all duration-200 hover:shadow-md ${
                    selected ? "border-brand-500 ring-2 ring-brand-500/20 bg-brand-50/10" : "border-border/80 hover:border-brand-500/50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => (onSelect ? onSelect(item) : setDetailsItem(item))}
                    className="relative aspect-square w-full overflow-hidden rounded-xl bg-surface-2/80 cursor-pointer border border-border/50"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={item.cardUrl ?? item.url}
                      alt={item.altText ?? ""}
                      className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />

                    {/* Format Badge */}
                    <span className="absolute top-1.5 left-1.5 rounded-md bg-black/60 px-1.5 py-0.5 text-[9px] font-bold text-white backdrop-blur-sm">
                      {ext}
                    </span>

                    {/* Selection Indicator */}
                    {selected && (
                      <span className="absolute top-1.5 right-1.5 grid h-6 w-6 place-items-center rounded-full bg-brand-500 text-white shadow-md">
                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </span>
                    )}

                    {/* Hover Inspector Button */}
                    <span
                      role="button"
                      tabIndex={0}
                      title="Inspect details"
                      onClick={(e) => {
                        e.stopPropagation();
                        setDetailsItem(item);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.stopPropagation();
                          e.preventDefault();
                          setDetailsItem(item);
                        }
                      }}
                      className="absolute bottom-1.5 right-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/65 text-white opacity-0 backdrop-blur-sm transition-all duration-200 group-hover:opacity-100 hover:bg-brand-500 hover:scale-110"
                    >
                      <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 16v-4M12 8h.01" />
                      </svg>
                    </span>
                  </button>

                  <div className="flex flex-col px-0.5 min-w-0">
                    <span className="truncate text-xs font-semibold text-text" title={mediaDisplayName(item.url)}>
                      {mediaDisplayName(item.url)}
                    </span>
                    <span className="truncate text-[10px] text-muted font-medium">
                      {item.width && item.height ? `${item.width}×${item.height} px` : item.type}
                    </span>
                  </div>

                  {renderItemActions?.(item)}
                </div>
              );
            })}
          </div>
        )}

        {/* --- Media Items View: List Mode --- */}
        {!isLoading && filteredMedia.length > 0 && viewMode === "list" && (
          <div className="flex flex-col rounded-2xl border border-border/80 bg-surface overflow-hidden shadow-sm">
            <div className="grid grid-cols-[auto_1fr_120px_100px_auto] items-center gap-4 border-b border-border/70 bg-surface-2/60 px-4 py-2.5 text-[11px] font-bold uppercase tracking-wider text-muted">
              <span className="w-10">Item</span>
              <span>Name</span>
              <span>Dimensions</span>
              <span>Type</span>
              <span className="text-right">Actions</span>
            </div>

            <div className="divide-y divide-border/60">
              {filteredMedia.map((item) => {
                const selected = isSelected?.(item) ?? false;
                const ext = (mediaExtension(item.url) || item.type || "").toUpperCase();

                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={(e) => e.dataTransfer.setData(MEDIA_ID_DND_TYPE, String(item.id))}
                    onClick={() => (onSelect ? onSelect(item) : setDetailsItem(item))}
                    className={`grid grid-cols-[auto_1fr_120px_100px_auto] items-center gap-4 px-4 py-2.5 cursor-pointer transition-colors hover:bg-surface-2/80 ${
                      selected ? "bg-brand-50/20" : ""
                    }`}
                  >
                    <div className="relative h-10 w-10 overflow-hidden rounded-lg border border-border/70 bg-surface-2 shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={item.cardUrl ?? item.url} alt="" className="h-full w-full object-cover" />
                      {selected && (
                        <span className="absolute inset-0 grid place-items-center bg-brand-500/80 text-white">
                          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth={3}>
                            <path d="M20 6 9 17l-5-5" />
                          </svg>
                        </span>
                      )}
                    </div>

                    <div className="flex flex-col min-w-0">
                      <span className="truncate text-xs font-semibold text-text">{mediaDisplayName(item.url)}</span>
                      {item.altText && <span className="truncate text-[11px] text-muted">{item.altText}</span>}
                    </div>

                    <span className="text-xs font-medium text-muted">
                      {item.width && item.height ? `${item.width}×${item.height}` : "—"}
                    </span>

                    <div>
                      <span className="rounded-md bg-surface-2 border border-border/70 px-2 py-0.5 text-[10px] font-bold text-secondary">
                        {ext}
                      </span>
                    </div>

                    <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => setDetailsItem(item)}
                        title="View details"
                        className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text"
                      >
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth={2}>
                          <circle cx="12" cy="12" r="9" />
                          <path d="M12 16v-4M12 8h.01" />
                        </svg>
                      </button>
                      {renderItemActions?.(item)}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* --- Details Slide-Over Panel --- */}
      {detailsItem && (
        <MediaDetailsPanel
          item={media?.find((m) => m.id === detailsItem.id) ?? detailsItem}
          onClose={() => setDetailsItem(null)}
          isModal={inModal}
        />
      )}
    </div>
  );
}

/* --- Folder Tile Card --- */
function FolderTile({
  folder,
  dragOver,
  onOpen,
  onDelete,
  onDragOver,
  onDragLeave,
  onDropFiles,
  onDropMediaId,
}: {
  folder: MediaFolderDto;
  dragOver: boolean;
  onOpen: () => void;
  onDelete: () => void;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDropFiles: (files: File[]) => void;
  onDropMediaId: (id: number) => void;
}) {
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        onDragOver();
      }}
      onDragLeave={onDragLeave}
      onDrop={(e) => {
        e.preventDefault();
        onDragLeave();
        if (e.dataTransfer.types.includes("Files")) {
          const files = Array.from(e.dataTransfer.files);
          if (files.length) onDropFiles(files);
          return;
        }
        const id = e.dataTransfer.getData(MEDIA_ID_DND_TYPE);
        if (id) onDropMediaId(Number(id));
      }}
      className={`group relative flex flex-col items-center gap-1.5 rounded-2xl border p-3 cursor-pointer transition-all duration-200 ${
        dragOver
          ? "border-brand-500 bg-brand-50/80 scale-105 shadow-md"
          : "border-border/80 bg-surface hover:border-brand-500/60 hover:bg-surface-2/60 hover:shadow-sm"
      }`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        aria-label="Delete folder"
        className="absolute right-1.5 top-1.5 hidden rounded-lg p-1 text-muted hover:bg-danger/10 hover:text-danger group-hover:block transition-colors"
      >
        {trashIcon}
      </button>

      <button type="button" onClick={onOpen} className="flex flex-col items-center gap-1.5 text-brand-500">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-brand-500/10 text-brand-600 transition-transform group-hover:scale-110">
          {folderIcon}
        </div>
      </button>

      <span className="max-w-full truncate text-xs font-bold text-text">{folder.name}</span>
    </div>
  );
}

