"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import type { PosProduct } from "@/lib/pos-cart";
import { DEFAULT_LABEL_SIZE, type LabelSize } from "@/lib/pos-labels";

/** Preview of one printed label: just the barcode and its number. */
export function Label({
  p,
  size = DEFAULT_LABEL_SIZE,
}: {
  p: PosProduct;
  size?: LabelSize;
}) {
  const svg = useRef<SVGSVGElement>(null);
  const code = p.barcode ?? "";
  useEffect(() => {
    if (!svg.current || !code) return;
    try {
      JsBarcode(svg.current, code, {
        format: /^\d{13}$/.test(code) ? "EAN13" : "CODE128",
        height: 34,
        width: 1.3,
        margin: 0,
        fontSize: 10,
        textMargin: 0,
        displayValue: true,
      });
    } catch {
      /* invalid code for the format: the label shows the fallback below */
    }
  }, [code]);
  return (
    <div
      className="pos-label flex items-center justify-center overflow-hidden bg-white text-black"
      style={{
        width: `${size.widthMm}mm`,
        height: `${size.heightMm}mm`,
        padding: "1mm",
        boxSizing: "border-box",
      }}
      title={p.name}
    >
      {code ? (
        <svg
          ref={svg}
          style={{
            maxWidth: `${size.widthMm - 2}mm`,
            maxHeight: `${size.heightMm - 2}mm`,
          }}
        />
      ) : (
        <div className="text-[7pt] text-red-600">No barcode</div>
      )}
    </div>
  );
}
