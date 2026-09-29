import JsBarcode from "jsbarcode";

/** Draws a barcode into a detached <svg> and returns its markup (null if none / invalid). */
export function barcodeSvg(code: string | null | undefined): string | null {
  if (!code) return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  const ean = /^\d{13}$/.test(code);
  try {
    JsBarcode(
      svg,
      code,
      ean
        ? // 1 unit per module and "flat" (no guard-bar overhang): exactly 95
          // modules wide, so it can be printed at a whole number of dots.
          {
            format: "EAN13",
            flat: true,
            width: 1,
            height: 38,
            margin: 0,
            fontSize: 8,
            textMargin: 1,
          }
        : {
            format: "CODE128",
            height: 40,
            width: 1.4,
            margin: 0,
            fontSize: 11,
            textMargin: 0,
            displayValue: true,
          },
    );
  } catch {
    return null;
  }
  // Scale to the label box instead of the fixed pixel size JsBarcode writes.
  svg.setAttribute(
    "viewBox",
    `0 0 ${svg.getAttribute("width")?.replace("px", "")} ${svg.getAttribute("height")?.replace("px", "")}`,
  );
  svg.setAttribute("preserveAspectRatio", "xMidYMid meet");
  svg.removeAttribute("width");
  svg.removeAttribute("height");
  // EAN-13 at 0.375mm per module = exactly 3 whole dots on a 203 dpi label
  // printer (35.6mm wide on a 40mm label). Tested: still decodes after heavy
  // blur, where 2 dots/module (0.25mm) failed.
  if (ean) svg.setAttribute("style", "width:35.625mm;height:auto");
  return svg.outerHTML;
}
