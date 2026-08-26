"use client";

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Puck, type Data } from "@puckeditor/core";
import "@puckeditor/core/no-external.css";
import { Button } from "@amader/admin-ui";
import { adminConfig } from "@/lib/page-builder-config";
import { usePage } from "@/hooks/usePages";
import { useStorefrontUrl } from "@/hooks/useStorefrontUrl";
import {
  useSaveLayout,
  usePublishLayout,
  usePreviewToken,
  useRevisions,
  useRestoreRevision,
  type BuilderLocale,
} from "@/hooks/usePageBuilder";

const EMPTY: Data = { root: { props: {} }, content: [] } as Data;

const AUTOSAVE_MS = 2000;

export default function PageBuilderPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: rawId } = use(params);
  const id = Number(rawId);

  const { data: page, isLoading } = usePage(id);
  const storefrontUrl = useStorefrontUrl();
  const [locale, setLocale] = useState<BuilderLocale>("EN");
  const [publishErrors, setPublishErrors] = useState<string[]>([]);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [dirty, setDirty] = useState(false);
  const [showRevisions, setShowRevisions] = useState(false);
  const [isFullScreen, setIsFullScreen] = useState(false);

  const kind = (page?.kind as "CONTENT" | "CHECKOUT" | undefined) ?? "CONTENT";
  const saveLayout = useSaveLayout(id);
  const publish = usePublishLayout(id, kind);
  const previewToken = usePreviewToken(id);
  const restoreRevision = useRestoreRevision(id);
  
  const { data: revisions, isLoading: revisionsLoading } = useRevisions(
    id,
    showRevisions,
  );

  const translation = page?.translations?.find(
    (t) => (t as unknown as { locale?: string }).locale === locale,
  );

  const initialData = useMemo(() => {
    const doc = translation?.draftLayout ?? translation?.layout;
    return (doc as Data | undefined) ?? EMPTY;
  }, [translation]);

  const puckKey = `${id}-${locale}-${translation ? "ready" : "empty"}`;

  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latest = useRef<Data | null>(null);
  const settled = useRef(false);

  const flush = useCallback(() => {
    const layout = latest.current;
    if (!layout) return;
    saveLayout.mutate(
      { locale, layout },
      {
        onSuccess: () => {
          setSavedAt(Date.now());
          setDirty(false);
        },
      },
    );
  }, [locale, saveLayout]);

  const onChange = useCallback(
    (data: Data) => {
      latest.current = data;
      if (!settled.current) {
        settled.current = true;
        return;
      }
      setDirty(true);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, AUTOSAVE_MS);
    },
    [flush],
  );

  useEffect(() => {
    function warn(e: BeforeUnloadEvent) {
      if (!dirty) return;
      e.preventDefault();
      e.returnValue = "";
    }
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  // Keyboard shortcut to exit fullscreen mode on Escape key
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && isFullScreen) {
        setIsFullScreen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isFullScreen]);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  async function handlePublish() {
    setPublishErrors([]);
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (latest.current) {
      try {
        await saveLayout.mutateAsync({ locale, layout: latest.current });
        setDirty(false);
        setSavedAt(Date.now());
      } catch {
        setPublishErrors(["Could not save the draft before publishing."]);
        return;
      }
    }
    try {
      await publish.mutateAsync({ locale });
    } catch (err) {
      const e = err as { details?: unknown; message?: string };
      const details = Array.isArray(e.details)
        ? (e.details as unknown[]).map(String).filter(Boolean)
        : [];
      setPublishErrors(
        details.length ? details : [e.message || "Publish failed."],
      );
    }
  }

  async function handlePreview() {
    if (timer.current) {
      clearTimeout(timer.current);
      timer.current = null;
    }
    if (latest.current) {
      await saveLayout.mutateAsync({ locale, layout: latest.current });
      setDirty(false);
      setSavedAt(Date.now());
    }
    const { token } = await previewToken.mutateAsync();
    const lang = locale === "BN" ? "bn" : "en";
    // Explicit /en or /bn locale prefix is required so Next-Intl handles the
    // route without needing proxy rewrites (JWT tokens contain dots that skip matchers)
    window.open(
      `${storefrontUrl}/${lang}/pages/${page?.slug}/preview/${token}`,
      "_blank",
      "noopener",
    );
  }

  async function handleCopyToOtherLocale() {
    const other: BuilderLocale = locale === "EN" ? "BN" : "EN";
    const doc = latest.current ?? initialData;
    if (!doc) return;
    if (
      !window.confirm(
        `Replace the ${other} draft with a copy of this ${locale} layout? ` +
          `The ${other} published layout is not touched until you publish it.`,
      )
    ) {
      return;
    }
    await saveLayout.mutateAsync({ locale: other, layout: doc });
    setPublishErrors([]);
    window.alert(`Copied to the ${other} draft. Switch to ${other} to translate the text.`);
  }

  if (!Number.isFinite(id)) return <p className="p-8">Invalid page id.</p>;
  if (isLoading) return <p className="p-8 text-sm text-muted">Loading…</p>;
  if (!page) return <p className="p-8 text-sm text-muted">Page not found.</p>;

  const pageTitle = page.translations?.find((t: any) => t.locale === locale)?.title || page.slug;

  return (
    <div
      className={
        isFullScreen
          ? "fixed inset-0 z-[9999] flex h-screen w-screen flex-col bg-slate-900 overflow-hidden"
          : "-m-4 flex h-[calc(100vh-64px)] flex-col md:-m-6"
      }
    >
      {/* Sleek Builder Header Bar */}
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 bg-slate-900 px-4 py-2.5 text-white shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href={`/pages/${id}`}
            className="flex h-8 w-8 items-center justify-center rounded-md bg-slate-800 text-slate-300 transition-colors hover:bg-slate-700 hover:text-white"
            title="Back to Page Details"
          >
            ←
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white">{pageTitle}</span>
              <span className="rounded bg-slate-800 px-2 py-0.5 font-mono text-[10px] text-slate-400">
                /{page.slug}
              </span>
            </div>
          </div>

          {/* Locale switcher */}
          <div className="flex items-center rounded-md border border-slate-700 bg-slate-800 p-0.5">
            {(["EN", "BN"] as const).map((l) => (
              <button
                key={l}
                type="button"
                onClick={() => {
                  if (timer.current) {
                    clearTimeout(timer.current);
                    timer.current = null;
                    flush();
                  }
                  latest.current = null;
                  settled.current = false;
                  setLocale(l);
                  setPublishErrors([]);
                }}
                className={`rounded px-2.5 py-1 text-xs font-bold transition-colors ${
                  locale === l ? "bg-emerald-600 text-white shadow-sm" : "text-slate-400 hover:text-white"
                }`}
              >
                {l}
              </button>
            ))}
          </div>

          {/* Save status badge */}
          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400">
            {saveLayout.isPending ? (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <span className="h-2 w-2 animate-ping rounded-full bg-amber-400" />
                Saving…
              </span>
            ) : dirty ? (
              <span className="flex items-center gap-1.5 text-amber-400 font-medium">
                <span className="h-2 w-2 rounded-full bg-amber-400" />
                Unsaved changes
              </span>
            ) : savedAt ? (
              <span className="flex items-center gap-1.5 text-slate-400">
                <span className="h-2 w-2 rounded-full bg-emerald-500" />
                Saved {new Date(savedAt).toLocaleTimeString()}
              </span>
            ) : (
              <span className="text-slate-400">Draft ready</span>
            )}
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-2">
          {/* Focus Mode Fullscreen Toggle */}
          <button
            type="button"
            onClick={() => setIsFullScreen((prev) => !prev)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-bold transition-colors ${
              isFullScreen
                ? "bg-amber-400 text-slate-950 hover:bg-amber-300"
                : "bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white border border-slate-700"
            }`}
            title={isFullScreen ? "Exit Focus Mode (Esc)" : "Expand to Fullscreen Focus Mode"}
          >
            {isFullScreen ? (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M3.25 7.75a.75.75 0 01.75-.75h3a.75.75 0 010 1.5H5.56l2.97 2.97a.75.75 0 11-1.06 1.06L4.5 9.56v1.94a.75.75 0 01-1.25 0v-3.75zM16.75 7.75a.75.75 0 00-.75-.75h-3a.75.75 0 000 1.5h1.94l-2.97 2.97a.75.75 0 101.06 1.06l2.97-2.97v1.94a.75.75 0 001.5 0v-3.75z" clipRule="evenodd" />
                </svg>
                <span>Exit Focus (Esc)</span>
              </>
            ) : (
              <>
                <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5">
                  <path fillRule="evenodd" d="M3.25 3.75a.75.75 0 00-.75.75v3.75a.75.75 0 001.5 0V6.56l2.97 2.97a.75.75 0 001.06-1.06L5.06 5.5h1.94a.75.75 0 000-1.5h-3.75zM16.75 3.75a.75.75 0 00.75-.75v-3.75z" clipRule="evenodd" />
                </svg>
                <span>Focus Mode</span>
              </>
            )}
          </button>

          <button
            type="button"
            onClick={handleCopyToOtherLocale}
            disabled={saveLayout.isPending}
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50"
          >
            Copy to {locale === "EN" ? "BN" : "EN"}
          </button>

          <button
            type="button"
            onClick={() => setShowRevisions((v) => !v)}
            className="rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 hover:text-white"
          >
            Revisions
          </button>

          <button
            type="button"
            onClick={handlePreview}
            disabled={previewToken.isPending || saveLayout.isPending}
            className="flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-slate-700 hover:text-white disabled:opacity-50"
          >
            <svg viewBox="0 0 20 20" fill="currentColor" className="h-3.5 w-3.5 text-slate-300">
              <path d="M10 12.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z" />
              <path fillRule="evenodd" d="M.664 10.59a1.651 1.651 0 010-1.186A10.004 10.004 0 0110 3c4.257 0 7.893 2.66 9.336 6.41.147.381.147.804 0 1.186A10.004 10.004 0 0110 17c-4.257 0-7.893-2.66-9.336-6.41zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
            </svg>
            <span>{previewToken.isPending ? "Opening…" : "Preview"}</span>
          </button>

          <button
            type="button"
            onClick={handlePublish}
            disabled={publish.isPending || saveLayout.isPending}
            className="rounded-md bg-emerald-600 px-4 py-1.5 text-xs font-bold text-white shadow-sm transition-colors hover:bg-emerald-500 disabled:opacity-50"
          >
            {publish.isPending ? "Publishing…" : `Publish ${locale}`}
          </button>
        </div>
      </header>

      {publishErrors.length > 0 && (
        <div className="border-b border-red-200 bg-red-50 px-4 py-2.5 shrink-0">
          <p className="text-sm font-semibold text-red-700">
            Could not publish this layout
          </p>
          <ul className="mt-1 list-disc pl-5 text-sm text-red-700">
            {publishErrors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        </div>
      )}

      {!translation && (
        <div className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800 shrink-0">
          This page has no {locale} translation yet. Add one from the page
          editor before building its {locale} layout.
        </div>
      )}

      {showRevisions && (
        <div className="border-b border-line bg-white px-4 py-3 shrink-0">
          <div className="mb-2 flex items-center gap-2">
            <span className="font-ui text-sm font-semibold text-text">Revisions</span>
            <span className="text-xs text-muted">
              A snapshot is taken of the outgoing layout every time you publish.
            </span>
            <button
              type="button"
              className="ml-auto text-sm text-muted hover:underline"
              onClick={() => setShowRevisions(false)}
            >
              Close
            </button>
          </div>
          {revisionsLoading ? (
            <p className="text-sm text-muted">Loading…</p>
          ) : !revisions || revisions.length === 0 ? (
            <p className="text-sm text-muted">
              No revisions yet — the first snapshot is written when you publish
              over an existing layout.
            </p>
          ) : (
            <ul className="max-h-52 divide-y divide-line overflow-auto rounded-md border border-line">
              {revisions.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-3 py-2 text-sm">
                  <span className="font-medium text-text">{r.locale}</span>
                  <span className="text-muted">
                    {new Date(r.createdAt).toLocaleString()}
                  </span>
                  {r.label && <span className="text-muted">— {r.label}</span>}
                  <button
                    type="button"
                    className="ml-auto font-semibold text-emerald-600 hover:underline disabled:opacity-50"
                    disabled={restoreRevision.isPending}
                    onClick={async () => {
                      if (
                        !window.confirm(
                          "Restore this revision? It replaces the current " +
                            `${r.locale} layout immediately.`,
                        )
                      ) {
                        return;
                      }
                      try {
                        await restoreRevision.mutateAsync(r.id);
                        window.location.reload();
                      } catch (err) {
                        const e = err as { details?: unknown; message?: string };
                        const d = Array.isArray(e.details)
                          ? (e.details as unknown[]).map(String)
                          : [];
                        setPublishErrors(d.length ? d : [e.message || "Restore failed."]);
                        setShowRevisions(false);
                      }
                    }}
                  >
                    Restore
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Puck Canvas Container */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <Puck
          key={puckKey}
          config={adminConfig}
          data={initialData}
          onChange={onChange}
          iframe={{ enabled: true }}
          viewports={[
            { width: 390, label: "Mobile" },
            { width: 768, label: "Tablet" },
            { width: 1180, label: "Desktop" },
          ]}
          overrides={{ headerActions: () => <></> }}
        />
      </div>
    </div>
  );
}
