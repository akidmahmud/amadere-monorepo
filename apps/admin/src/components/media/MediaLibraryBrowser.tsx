"use client";

import { useRef, useState, type ReactNode } from "react";
import {
  useCreateMediaFolder,
  useDeleteMediaFolder,
  useMediaFolders,
  useMediaLibrary,
  useMoveMediaToFolder,
  useUploadMedia,
} from "@/hooks/useMedia";
import type { components } from "@/lib/api/schema";

type MediaDto = components["schemas"]["MediaDto"];
type MediaFolderDto = components["schemas"]["MediaFolderDto"];

const MEDIA_ID_DND_TYPE = "application/x-amader-media-id";

const folderIcon = (
  <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
  </svg>
);
const uploadIcon = (
  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);
const backIcon = (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);
const trashIcon = (
  <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 6h18" />
    <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
  </svg>
);

export interface MediaLibraryBrowserProps {
  /** Picker mode: clicking a media item calls this instead of just viewing it. */
  onSelect?: (media: MediaDto) => void;
  /**
   * Multi-select mode (e.g. a product's image gallery): marks already-chosen
   * items with a checkmark. The item stays clickable — onSelect keeps firing
   * on every click so the caller can toggle it back off — this never
   * disables the button, unlike the old per-widget "already added" grids it
   * replaced, which is exactly what made them impossible to unselect from
   * inside the modal.
   */
  isSelected?: (media: MediaDto) => boolean;
  /** Management extras rendered per item (e.g. a Delete button on the full library page). */
  renderItemActions?: (media: MediaDto) => ReactNode;
}

// Shared by MediaPicker's "Browse library" modal, ProductMediaGallery's
// gallery picker, and the sidebar's full Media Library page — same folder
// browsing, drag-and-drop upload, and drag-a-thumbnail-into-a-folder
// behavior everywhere, per explicit request that they "behave like same."
export function MediaLibraryBrowser({ onSelect, isSelected, renderItemActions }: MediaLibraryBrowserProps) {
  const [folderId, setFolderId] = useState<number | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<number | null>(null);
  const [dropzoneActive, setDropzoneActive] = useState(false);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  const { data: folders } = useMediaFolders();
  const { data: media, isLoading } = useMediaLibrary(folderId === null ? { unfiled: true } : { folderId });
  const upload = useUploadMedia();
  const moveMedia = useMoveMediaToFolder();
  const createFolder = useCreateMediaFolder();
  const deleteFolder = useDeleteMediaFolder();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentFolder = folders?.find((f) => f.id === folderId);

  async function uploadFiles(files: File[], targetFolderId: number | null) {
    for (const file of files) {
      const item = await upload.mutateAsync(file);
      if (targetFolderId !== null) moveMedia.mutate({ id: item.id, folderId: targetFolderId });
    }
  }

  function handleCreateFolder() {
    const name = newFolderName.trim();
    if (!name) return;
    createFolder.mutate(name, { onSuccess: () => setNewFolderName("") });
    setCreatingFolder(false);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-text">
          {currentFolder && (
            <button
              type="button"
              onClick={() => setFolderId(null)}
              aria-label="Back to All Media"
              className="mr-1 grid h-7 w-7 place-items-center rounded-sm text-text hover:bg-surface-2"
            >
              {backIcon}
            </button>
          )}
          <button type="button" onClick={() => setFolderId(null)} className={folderId === null ? "text-brand-500" : "text-brand-500 hover:underline"}>
            All Media
          </button>
          {currentFolder && (
            <>
              <span className="text-muted">/</span>
              <span>{currentFolder.name}</span>
            </>
          )}
        </div>

        {folderId === null &&
          (creatingFolder ? (
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
                className="h-8 rounded-sm border border-border bg-surface px-2.5 text-xs text-text outline-none focus:border-brand-500"
              />
              <button type="button" onClick={handleCreateFolder} className="h-8 rounded-sm bg-brand-500 px-2.5 text-xs font-bold text-white hover:bg-brand-600">
                Create
              </button>
              <button type="button" onClick={() => setCreatingFolder(false)} className="h-8 rounded-sm px-2 text-xs font-semibold text-muted hover:bg-surface-2">
                Cancel
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setCreatingFolder(true)}
              className="inline-flex h-8 items-center gap-1.5 rounded-sm border border-border px-2.5 text-xs font-bold text-text hover:bg-surface-2"
            >
              + New Folder
            </button>
          ))}
      </div>

      {/* OS file drag-and-drop + click-to-upload, straight into whichever folder is open. */}
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
        className={`flex h-[90px] cursor-pointer flex-col items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed text-muted transition-colors ${
          dropzoneActive ? "border-brand-500 bg-brand-50" : "border-[#c8d6ec] hover:border-brand-500"
        }`}
      >
        {uploadIcon}
        <span className="text-[0.76rem] font-semibold">{upload.isPending ? "Uploading…" : "Drag & drop images here, or click to upload"}</span>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) uploadFiles(files, folderId);
          }}
        />
      </div>

      {/* Folders only make sense to show/drop-onto from the root view. */}
      {folderId === null && folders && folders.length > 0 && (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(120px,1fr))] gap-3">
          {folders.map((f) => (
            <FolderTile
              key={f.id}
              folder={f}
              dragOver={dragOverFolderId === f.id}
              onOpen={() => setFolderId(f.id)}
              onDelete={() => {
                if (confirm(`Delete folder "${f.name}"? Media inside stays — it just becomes unfiled.`)) deleteFolder.mutate(f.id);
              }}
              onDragOver={() => setDragOverFolderId(f.id)}
              onDragLeave={() => setDragOverFolderId(null)}
              onDropFiles={(files) => uploadFiles(files, f.id)}
              onDropMediaId={(id) => moveMedia.mutate({ id, folderId: f.id })}
            />
          ))}
        </div>
      )}

      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {media && media.length === 0 && <p className="text-sm text-muted">No media here yet.</p>}

      <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-4">
        {media?.map((item) => {
          const selected = isSelected?.(item) ?? false;
          return (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => e.dataTransfer.setData(MEDIA_ID_DND_TYPE, String(item.id))}
              className="flex flex-col gap-2 rounded-inner border border-border bg-surface p-2.5"
            >
              <button
                type="button"
                onClick={() => onSelect?.(item)}
                className={`relative overflow-hidden rounded-inner border transition-colors ${
                  selected ? "border-brand-500" : "border-transparent"
                } ${onSelect ? "cursor-pointer hover:border-brand-500" : "cursor-grab"}`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={item.url} alt={item.altText ?? ""} className="aspect-square w-full object-cover" />
                {selected && (
                  <span className="absolute right-1 top-1 grid h-5 w-5 place-items-center rounded-full bg-brand-500 text-white">
                    <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  </span>
                )}
              </button>
              <div className="truncate text-[11px] text-muted">{item.width && item.height ? `${item.width}×${item.height}` : item.type}</div>
              {renderItemActions?.(item)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

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
      className={`group relative flex flex-col items-center gap-1.5 rounded-inner border p-3 transition-colors ${
        dragOver ? "border-brand-500 bg-brand-50" : "border-border bg-surface hover:border-brand-500"
      }`}
    >
      <button type="button" onClick={onDelete} aria-label="Delete folder" className="absolute right-1.5 top-1.5 hidden rounded-sm p-1 text-muted hover:bg-surface-2 hover:text-danger group-hover:block">
        {trashIcon}
      </button>
      <button type="button" onClick={onOpen} className="flex flex-col items-center gap-1.5 text-brand-500">
        {folderIcon}
      </button>
      <span className="max-w-full truncate text-xs font-semibold text-text">{folder.name}</span>
    </div>
  );
}
