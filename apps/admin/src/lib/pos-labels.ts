export interface LabelData {
  /** Rendered barcode <svg> markup; null when the product has no barcode. */
  barcodeSvg: string | null;
}

/** Label printer paper, POS Settings › Labels. */
export interface LabelSize {
  widthMm: number;
  heightMm: number;
}
export const DEFAULT_LABEL_SIZE: LabelSize = { widthMm: 38, heightMm: 25 };

/**
 * A standalone print document: nothing but the labels (the barcode and its
 * number), each exactly one label-sized page. Printing the admin page itself
 * (hiding everything else) left the hidden content taking space — a tiny
 * label on a letter-size sheet plus blank pages — and the browser ignored
 * the label page size.
 */
export function buildLabelSheet(
  labels: LabelData[],
  size: LabelSize = DEFAULT_LABEL_SIZE,
): string {
  const w = Number(size.widthMm) || DEFAULT_LABEL_SIZE.widthMm;
  const h = Number(size.heightMm) || DEFAULT_LABEL_SIZE.heightMm;
  const body = labels
    .map(
      (l) =>
        `<div class="label">${l.barcodeSvg ?? '<span class="missing">No barcode</span>'}</div>`,
    )
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
@page { size: ${w}mm ${h}mm; margin: 0; }
html, body { margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; color: #000; }
.label { width: ${w}mm; height: ${h}mm; box-sizing: border-box; padding: 1mm; overflow: hidden;
  display: flex; align-items: center; justify-content: center; break-after: page; page-break-after: always; }
.label:last-child { break-after: auto; page-break-after: auto; }
.label svg { max-width: ${w - 2}mm; max-height: ${h - 2}mm; }
.missing { font-size: 7pt; color: #c00; }
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
