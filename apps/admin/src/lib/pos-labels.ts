import { formatWeight } from "./pos-weight.ts";

export interface LabelData {
  /** Rendered barcode <svg> markup; null when the product has no barcode. */
  barcodeSvg: string | null;
  /** Printed above the barcode when the setting is on. */
  name?: string | null;
  size?: string | null;
}

/** Label printer paper and what goes on it, POS Settings › Labels. */
export interface LabelSize {
  widthMm: number;
  heightMm: number;
  showName?: boolean;
  showSize?: boolean;
}
export const DEFAULT_LABEL_SIZE: LabelSize = {
  widthMm: 38,
  heightMm: 25,
  showName: true,
  showSize: true,
};

/** The size line: pack size ("1KG"), else this store's / the product's weight. */
export function labelSizeText(p: {
  variantLabel?: string | null;
  storeWeightKg?: string | null;
  normalWeightKg?: string | null;
  storeWeightUnit?: string | null;
  normalWeightUnit?: string | null;
}): string | null {
  if (p.variantLabel && !p.storeWeightKg) return p.variantLabel;
  const kg = p.storeWeightKg ?? p.normalWeightKg;
  return (
    formatWeight(
      kg,
      p.storeWeightKg ? p.storeWeightUnit : p.normalWeightUnit,
    ) ??
    p.variantLabel ??
    null
  );
}

const esc = (v: unknown) =>
  String(v ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );

/**
 * A standalone print document: nothing but the labels (optional name and
 * size lines, then the barcode and its number), each exactly one label-sized
 * page. Printing the admin page itself (hiding everything else) left the
 * hidden content taking space — a tiny label on a letter-size sheet plus
 * blank pages — and the browser ignored the label page size.
 */
export function buildLabelSheet(
  labels: LabelData[],
  size: LabelSize = DEFAULT_LABEL_SIZE,
): string {
  const w = Number(size.widthMm) || DEFAULT_LABEL_SIZE.widthMm;
  const h = Number(size.heightMm) || DEFAULT_LABEL_SIZE.heightMm;
  const showName = size.showName ?? true;
  const showSize = size.showSize ?? true;
  // Room the text lines take; the barcode gets the rest of the height.
  const textMm = (showName ? 3.4 : 0) + (showSize ? 3 : 0);
  const body = labels
    .map((l) => {
      const name =
        showName && l.name ? `<div class="name">${esc(l.name)}</div>` : "";
      const sz =
        showSize && l.size ? `<div class="size">${esc(l.size)}</div>` : "";
      return `<div class="label">${name}${sz}<div class="code">${l.barcodeSvg ?? '<span class="missing">No barcode</span>'}</div></div>`;
    })
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
@page { size: ${w}mm ${h}mm; margin: 0; }
html, body { margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; color: #000; }
.label { width: ${w}mm; height: ${h}mm; box-sizing: border-box; padding: 1mm; overflow: hidden;
  display: flex; flex-direction: column; align-items: center; justify-content: center; break-after: page; page-break-after: always; }
.label:last-child { break-after: auto; page-break-after: auto; }
.name { width: 100%; font-size: 7.5pt; font-weight: bold; line-height: 1.15; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.size { font-size: 7pt; line-height: 1.1; text-align: center; margin-bottom: 0.4mm; }
.code { line-height: 0; text-align: center; }
.label svg { max-width: ${w - 2}mm; max-height: ${Math.max(6, h - 2 - textMm).toFixed(1)}mm; }
.missing { font-size: 7pt; color: #c00; line-height: 1; }
</style></head><body>
${body}
</body></html>`;
}

/** Prints the sheet from a hidden iframe so the admin page's layout can't interfere. */
export function printLabelSheet(html: string): void {
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  const win = frame.contentWindow!;
  // Give the SVGs a moment to lay out, then print; tidy up afterwards.
  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(() => frame.remove(), 1000);
  }, 150);
}
