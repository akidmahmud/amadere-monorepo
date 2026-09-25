"use client";

import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";
import { taka, type PosProduct } from "@/lib/pos-cart";

/** One 40×30mm shelf/pack label: name, pack size, price, barcode, Amader®. */
export function Label({ p }: { p: PosProduct }) {
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
      className="pos-label flex flex-col items-center justify-between overflow-hidden bg-white text-black"
      style={{
        width: "40mm",
        height: "30mm",
        padding: "1mm",
        breakAfter: "page",
        boxSizing: "border-box",
      }}
    >
      <div className="w-full truncate text-center text-[8pt] font-bold leading-tight">
        {p.name}
      </div>
      <div className="flex w-full justify-between text-[7pt] leading-none">
        <span className="truncate">{p.variantLabel ?? ""}</span>
        <span className="shrink-0 font-bold">
          {taka(p.salePrice ?? p.price)}
        </span>
      </div>
      {code ? (
        <svg ref={svg} style={{ maxWidth: "38mm", height: "15mm" }} />
      ) : (
        <div className="text-[7pt] text-red-600">No barcode</div>
      )}
      <div className="text-[6pt] leading-none">Amader®</div>
    </div>
  );
}
