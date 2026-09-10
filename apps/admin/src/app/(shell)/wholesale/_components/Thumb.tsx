"use client";

/**
 * Product thumbnail for the picker, the cart and the order detail table.
 *
 * Falls back to the first letter of the name rather than a broken-image icon —
 * plenty of products have no media yet, and a row that looks broken reads as
 * an error rather than as "no picture".
 */
export function Thumb({
  url,
  name,
  size = 36,
}: {
  url: string | null;
  name: string;
  size?: number;
}) {
  const box = { width: size, height: size };

  if (!url) {
    return (
      <span
        style={box}
        aria-hidden
        className="grid flex-none place-items-center rounded-lg bg-surface-2 text-[11px] font-black text-muted"
      >
        {name.charAt(0).toUpperCase()}
      </span>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element -- R2/CDN URLs are
    // remote and arbitrary; next/image would need every host allow-listed.
    <img
      src={url}
      alt=""
      style={box}
      loading="lazy"
      className="flex-none rounded-lg border border-border object-cover"
    />
  );
}
