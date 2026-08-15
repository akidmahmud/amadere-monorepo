"use client";

import { useRef, useState } from "react";
import { Button, Card, Icon, Modal } from "@amader/admin-ui";
import { usePickerProducts } from "@/hooks/usePickers";
import { useProductSearch } from "@/hooks/useProducts";
import { useUploadMedia } from "@/hooks/useMedia";
import { MediaLibraryBrowser } from "@/components/media/MediaLibraryBrowser";
import { SeoMetaCard } from "@/components/SeoMetaCard";
import {
  PROMO_VIDEO_SOURCES,
  useCreatePromoVideo,
  useDeletePromoVideo,
  useUpdatePromoVideo,
  type AdminPromoVideo,
  type PromoVideoSource,
} from "@/hooks/usePromoVideos";
import { SOURCE_META } from "./PromoVideoSourceIcon";

const URL_PLACEHOLDER: Record<PromoVideoSource, string> = {
  YOUTUBE: "https://youtube.com/watch?v=... or /shorts/...",
  TIKTOK: "https://tiktok.com/@user/video/...",
  INSTAGRAM: "https://instagram.com/reel/...",
  FACEBOOK: "https://facebook.com/reel/...",
  CUSTOM_URL: "https://example.com/video.mp4",
  R2: "",
  GIF: "",
};

function isValidUrl(value: string): boolean {
  if (!value) return false;
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}

export function PromoVideoEditPanel({
  video,
  onSaved,
  onRemoved,
  onCancel,
}: {
  /** null = "Add New Video" mode */
  video: AdminPromoVideo | null;
  onSaved: (id: number) => void;
  onRemoved: () => void;
  onCancel: () => void;
}) {
  const [title, setTitle] = useState(video?.title ?? "");
  const [source, setSource] = useState<PromoVideoSource>(video?.source ?? "YOUTUBE");
  const [url, setUrl] = useState(video?.url ?? "");
  const [thumbnailUrl, setThumbnailUrl] = useState(video?.thumbnailUrl ?? "");
  const [durationSeconds, setDurationSeconds] = useState(video?.durationSeconds?.toString() ?? "");
  const [productId, setProductId] = useState<number | undefined>(video?.productId ?? undefined);
  // Set directly from a search result at selection time — usePickerProducts
  // below only ever holds the first 100 products (see that hook's own
  // comment), so a product found via search isn't guaranteed to be in it.
  // Only falls back to looking it up there for the initial edit-mode value
  // (AdminPromoVideoDto only carries productId, no product name alongside it).
  const [selectedProductLabel, setSelectedProductLabel] = useState<string | undefined>(undefined);
  const [productQuery, setProductQuery] = useState("");
  const [showInHomepage, setShowInHomepage] = useState(video?.showInHomepage ?? true);
  const [showLibrary, setShowLibrary] = useState(false);

  const { data: products } = usePickerProducts();
  const { data: productSearchResults } = useProductSearch(productQuery);
  const linkedProductLabel = selectedProductLabel ?? products?.find((p) => p.id === productId)?.label;
  const create = useCreatePromoVideo();
  const update = useUpdatePromoVideo(video?.id ?? -1);
  const remove = useDeletePromoVideo();
  const upload = useUploadMedia();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const thumbInputRef = useRef<HTMLInputElement>(null);

  const isFileSource = source === "R2" || source === "GIF";
  const urlLooksValid = isFileSource ? url.length > 0 : isValidUrl(url);
  const saving = create.isPending || update.isPending;

  async function handleThumbnailFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const media = await upload.mutateAsync(file);
    setThumbnailUrl(media.url);
  }

  async function handleUrlFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    const media = await upload.mutateAsync(file);
    setUrl(media.url);
  }

  async function handleSave() {
    const input = {
      title,
      source,
      url,
      durationSeconds: durationSeconds ? Number(durationSeconds) : undefined,
      thumbnailUrl: thumbnailUrl || undefined,
      productId,
      showInHomepage,
    };
    const saved = video ? await update.mutateAsync(input) : await create.mutateAsync(input);
    onSaved(saved.id);
  }

  return (
    <Card className="flex flex-col gap-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="font-ui text-base font-bold text-text">Add / Edit Video</h2>
          <p className="text-xs text-muted">
            {video ? "Edit this promotional video." : "Add a new promotional video to showcase on your homepage."}
          </p>
        </div>
        {video && (
          <Button
            type="button"
            variant="ghost"
            style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            onClick={() => {
              if (confirm(`Delete "${video.title}"? This can't be undone.`)) {
                remove.mutate(video.id, { onSuccess: onRemoved });
              }
            }}
          >
            <Icon name="delete" size={16} /> Remove
          </Button>
        )}
      </div>

      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Title</span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Amader Box — 500 Taka for 5 Healthy Snacks"
          className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </label>

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-bold text-text">1. Select Video Source</h3>
          <p className="text-xs text-muted">Choose where your video is hosted</p>
        </div>
        <div className="grid grid-cols-3 gap-2.5">
          {PROMO_VIDEO_SOURCES.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => {
                setSource(s);
                setUrl("");
              }}
              className={`flex flex-col items-center gap-1.5 rounded-[10px] border p-3 text-xs font-semibold transition-colors ${
                source === s ? "border-brand-500 bg-brand-50 text-brand-500" : "border-border bg-surface text-secondary hover:bg-surface-2"
              }`}
            >
              <span className="grid h-6 w-6 place-items-center">{SOURCE_META[s].icon}</span>
              {SOURCE_META[s].label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-bold text-text">2. Video Link</h3>
          <p className="text-xs text-muted">{isFileSource ? "Upload a video file" : "Paste your video link"}</p>
        </div>
        {isFileSource ? (
          <div className="flex items-center gap-3">
            <input ref={fileInputRef} type="file" accept="video/*,image/gif" className="hidden" onChange={handleUrlFile} />
            <Button type="button" variant="ghost" disabled={upload.isPending} onClick={() => fileInputRef.current?.click()}>
              {upload.isPending ? "Uploading…" : url ? "Replace file" : "Upload file"}
            </Button>
            {url && <span className="truncate text-xs text-muted">{url}</span>}
          </div>
        ) : (
          <div className="relative">
            <input
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={URL_PLACEHOLDER[source]}
              className="h-10 w-full rounded-sm border border-border bg-surface px-3 pr-10 text-sm text-text outline-none focus:border-brand-500"
            />
            {urlLooksValid && (
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#16a06d]">
                <Icon name="check_circle" size={18} fill />
              </span>
            )}
          </div>
        )}
        <label className="flex max-w-[140px] flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Duration (mm:ss, optional)</span>
          <input
            type="number"
            min={0}
            value={durationSeconds}
            onChange={(e) => setDurationSeconds(e.target.value)}
            placeholder="Seconds"
            className="h-9 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
      </div>

      <div className="flex flex-col gap-3">
        <div>
          <h3 className="text-sm font-bold text-text">3. Thumbnail</h3>
          <p className="text-xs text-muted">This thumbnail will be shown before video plays</p>
        </div>
        <div className="flex items-start gap-4">
          <div className="grid h-24 w-24 flex-none place-items-center overflow-hidden rounded-[10px] border border-border bg-surface-2">
            {thumbnailUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <Icon name="image" size={28} className="text-muted" />
            )}
          </div>
          <div className="flex flex-1 flex-col gap-2">
            <input ref={thumbInputRef} type="file" accept="image/*" className="hidden" onChange={handleThumbnailFile} />
            <Button type="button" variant="ghost" disabled={upload.isPending} onClick={() => thumbInputRef.current?.click()}>
              <Icon name="upload" size={16} /> {upload.isPending ? "Uploading…" : "Upload Thumbnail"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setShowLibrary(true)}>
              <Icon name="perm_media" size={16} /> Choose from Library
            </Button>
            <p className="text-[0.68rem] text-muted">Recommended size: 1080×1920 (9:16) or 1080×1080 (1:1)</p>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <h3 className="text-sm font-bold text-text">4. Linked Product (Optional)</h3>
        <p className="text-xs text-muted">Select a product to open when video is clicked</p>
        <div className="flex flex-col gap-2">
          <div className="relative">
            <input
              value={productQuery}
              onChange={(e) => setProductQuery(e.target.value)}
              placeholder="Search products by name…"
              className="h-10 w-full rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
            />
            {productQuery.trim() && productSearchResults && productSearchResults.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-64 w-full overflow-y-auto rounded-sm border border-border bg-surface p-1.5 shadow-card">
                {productSearchResults.map((p) => {
                  const label = p.name;
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => {
                        setProductId(p.id);
                        setSelectedProductLabel(label);
                        setProductQuery("");
                      }}
                      className="block w-full truncate rounded-sm px-3 py-2 text-left text-sm text-text hover:bg-surface-2"
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
          {productId !== undefined && (
            <div className="flex items-center gap-2 rounded-sm border border-border bg-surface-2 px-3 py-2 text-sm text-text">
              <span className="min-w-0 flex-1 truncate">{linkedProductLabel ?? `Product #${productId}`}</span>
              <button
                type="button"
                aria-label="Clear linked product"
                onClick={() => {
                  setProductId(undefined);
                  setSelectedProductLabel(undefined);
                }}
                className="shrink-0 text-muted hover:text-text"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between rounded-[10px] bg-surface-2 p-3">
        <div>
          <div className="text-sm font-semibold text-text">Show in homepage</div>
          <div className="text-xs text-muted">Display this video section on the homepage</div>
        </div>
        <label className="relative inline-flex h-[22px] w-10 flex-none cursor-pointer items-center">
          <input type="checkbox" checked={showInHomepage} onChange={(e) => setShowInHomepage(e.target.checked)} className="peer sr-only" />
          <span className="absolute inset-0 rounded-pill bg-[#dfe5ee] transition-colors peer-checked:bg-brand-500" />
          <span className="absolute left-[3px] h-4 w-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-[18px]" />
        </label>
      </div>

      {video && (
        <SeoMetaCard entityType="PROMO_VIDEO" entityId={video.id} fallbackTitle={video.title} />
      )}

      <div className="flex justify-end gap-3">
        <Button type="button" variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="button" variant="primary" disabled={!title || !url || saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save Video"}
        </Button>
      </div>

      <Modal open={showLibrary} onClose={() => setShowLibrary(false)} title="Browse media library" className="max-w-5xl">
        <MediaLibraryBrowser
          onSelect={(media) => {
            setThumbnailUrl(media.url);
            setShowLibrary(false);
          }}
        />
      </Modal>
    </Card>
  );
}
