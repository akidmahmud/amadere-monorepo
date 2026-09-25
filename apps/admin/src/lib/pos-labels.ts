export interface LabelData {
  name: string;
  variant?: string | null;
  price: string;
  /** Rendered barcode <svg> markup; null when the product has no barcode. */
  barcodeSvg: string | null;
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
 * A standalone print document: nothing but the labels, each exactly one
 * 40×30mm page. Printing the admin page itself (hiding everything else) left
 * the hidden content taking space — a tiny label on a letter-size sheet plus
 * blank pages — and the browser ignored the label page size.
 */
export function buildLabelSheet(labels: LabelData[]): string {
  const body = labels
    .map(
      (l) => `<div class="label">
  <div class="name">${esc(l.name)}</div>
  <div class="row"><span class="variant">${esc(l.variant)}</span><span class="price">${esc(l.price)}</span></div>
  <div class="code">${l.barcodeSvg ?? '<span class="missing">No barcode</span>'}</div>
  <div class="brand">Amader®</div>
</div>`,
    )
    .join("\n");
  return `<!doctype html><html><head><meta charset="utf-8"><title>Labels</title><style>
@page { size: 40mm 30mm; margin: 0; }
html, body { margin: 0; padding: 0; }
body { font-family: Arial, Helvetica, sans-serif; color: #000; }
.label { width: 40mm; height: 30mm; box-sizing: border-box; padding: 1mm 1.5mm; overflow: hidden;
  display: flex; flex-direction: column; justify-content: space-between; break-after: page; page-break-after: always; }
.label:last-child { break-after: auto; page-break-after: auto; }
.name { font-size: 7.5pt; font-weight: bold; line-height: 1.1; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.row { display: flex; justify-content: space-between; font-size: 7pt; line-height: 1; }
.price { font-weight: bold; }
.code { text-align: center; line-height: 0; }
.code svg { width: 37mm; height: 14mm; }
.missing { font-size: 7pt; color: #c00; line-height: 1; }
.brand { font-size: 6pt; text-align: center; line-height: 1; }
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
