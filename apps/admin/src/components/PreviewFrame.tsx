"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * Renders children inside an iframe so they get a REAL viewport of the given
 * width.
 *
 * Why this exists: a device preview built by putting the content in a
 * `max-w-[390px]` div does not work. CSS media queries resolve against the
 * browser window, not the ancestor element — so `md:`/`lg:` classes still
 * match on a 1440px monitor and you see the desktop layout squeezed into a
 * narrow box, which is exactly what the real phone does NOT look like. An
 * iframe has its own viewport, so the same breakpoints resolve against its
 * width and the mobile layout actually renders.
 *
 * The parent document's stylesheets are copied in (and kept in sync, since
 * Next injects more of them on hot reload), because an iframe inherits no
 * styles from its parent.
 */
export function PreviewFrame({
  width,
  children,
  className,
}: {
  /** Viewport width in px, or "100%" to fill the available space. */
  width: number | "100%";
  children: ReactNode;
  className?: string;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const [height, setHeight] = useState(400);

  // Copy the host page's styles into the frame, and keep copying as Next adds
  // more during hot reloads. Without the observer the preview renders unstyled
  // after any HMR update that injects a new <style>.
  useEffect(() => {
    const doc = frameRef.current?.contentDocument;
    if (!doc) return;

    const sync = () => {
      doc.head.querySelectorAll("[data-preview-style]").forEach((n) => n.remove());
      document.head.querySelectorAll('link[rel="stylesheet"], style').forEach((node) => {
        const copy = node.cloneNode(true) as HTMLElement;
        copy.setAttribute("data-preview-style", "");
        doc.head.appendChild(copy);
      });
    };

    // The preview shows the storefront, which is a light-only design. Pin the
    // colour scheme so the admin's own dark mode (or the OS preference) does
    // not repaint it into something the visitor will never see.
    doc.documentElement.style.colorScheme = "light";
    doc.body.style.margin = "0";
    doc.body.style.background = "#fff";

    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.head, { childList: true });

    setMountNode(doc.body);
    return () => observer.disconnect();
  }, []);

  // Grow the frame to fit its content — an iframe has no auto height, so
  // without this the preview is cut off at the default 150px.
  useEffect(() => {
    if (!mountNode) return;
    const observer = new ResizeObserver(() => setHeight(mountNode.scrollHeight));
    observer.observe(mountNode);
    setHeight(mountNode.scrollHeight);
    return () => observer.disconnect();
  }, [mountNode, width]);

  return (
    <iframe
      ref={frameRef}
      title="Footer preview"
      className={className}
      style={{
        width: width === "100%" ? "100%" : `${width}px`,
        height: `${height}px`,
        border: "none",
        display: "block",
      }}
    >
      {mountNode ? createPortal(children, mountNode) : null}
    </iframe>
  );
}
