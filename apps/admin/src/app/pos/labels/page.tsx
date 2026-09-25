"use client";

import JsBarcode from "jsbarcode";
import { buildLabelSheet, printLabelSheet } from "@/lib/pos-labels";
import { taka } from "@/lib/pos-cart";
import { useState } from "react";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { posLookup, useStockPost } from "@/hooks/usePos";
import type { PosProduct } from "@/lib/pos-cart";
import { usePosContext } from "@/components/pos/PosContext";
import { Label } from "@/components/pos/Label";
import {
  PosSubPage,
  ProductPicker,
  card,
  input,
  primaryBtn,
  productLabel,
} from "@/components/pos/PosSubPage";

type Row = { p: PosProduct; copies: string };
const key = (p: PosProduct) => `${p.productId}:${p.variantId ?? 0}`;

export default function LabelsPage() {
  const { storeId } = usePosContext();
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const generate = useStockPost<
    { productIds: number[] },
    { generated: number }
  >("/admin/stock/barcodes/generate");
  const missing = rows.filter((r) => !r.p.barcode);

  const refresh = async () => {
    // Re-read each queued SKU so freshly generated barcodes appear.
    const fresh = await Promise.all(
      rows.map((r) => posLookup(r.p.sku ?? r.p.name, storeId).catch(() => r.p)),
    );
    setRows((rs) =>
      rs.map((r) => ({
        ...r,
        p: fresh.find((f) => key(f) === key(r.p)) ?? r.p,
      })),
    );
  };

  const printable = rows.flatMap((r) =>
    r.p.barcode
      ? Array.from({ length: Math.max(0, Number(r.copies) || 0) }, () => r.p)
      : [],
  );

  return (
    <PosSubPage title="Barcode labels" permission="pos.labels">
      <div className={`${card} space-y-4`}>
        <ProductPicker
          onPick={(p) =>
            setRows((rs) =>
              rs.some((r) => key(r.p) === key(p))
                ? rs
                : [...rs, { p, copies: "1" }],
            )
          }
          placeholder="Scan or search products to label…"
        />
        {rows.length > 0 && (
          <table className="w-full text-sm">
            <thead className="text-left text-gray-500">
              <tr>
                <th className="py-2">Product</th>
                <th>Barcode</th>
                <th className="w-24">Copies</th>
                <th className="w-10" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={key(r.p)} className="border-t border-gray-100">
                  <td className="py-2">{productLabel(r.p)}</td>
                  <td
                    className={
                      r.p.barcode
                        ? "font-mono text-xs"
                        : "text-xs font-semibold text-red-600"
                    }
                  >
                    {r.p.barcode ?? "none — generate"}
                  </td>
                  <td>
                    <input
                      value={r.copies}
                      onChange={(e) =>
                        setRows((rs) =>
                          rs.map((x, j) =>
                            j === i ? { ...x, copies: e.target.value } : x,
                          ),
                        )
                      }
                      inputMode="numeric"
                      className={`${input} w-20`}
                      aria-label="Copies"
                    />
                  </td>
                  <td>
                    <button
                      onClick={() =>
                        setRows((rs) => rs.filter((_, j) => j !== i))
                      }
                      aria-label="Remove"
                      className="text-gray-400 hover:text-red-500"
                    >
                      <Icon name="close" size={18} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex flex-wrap gap-2">
          {missing.length > 0 && (
            <button
              className="h-10 rounded-lg border border-[#1d7a46] px-4 text-sm font-bold text-[#1d7a46]"
              disabled={generate.isPending}
              onClick={() =>
                generate.mutate(
                  {
                    productIds: [...new Set(missing.map((r) => r.p.productId))],
                  },
                  {
                    onSuccess: async (r) => {
                      toast.push(
                        `${r.generated} barcode(s) generated`,
                        "success",
                      );
                      await refresh();
                    },
                    onError: (e) => toast.push(e.message),
                  },
                )
              }
            >
              Generate {missing.length} missing barcode
              {missing.length > 1 ? "s" : ""}
            </button>
          )}
          <button
            className={primaryBtn}
            disabled={printable.length === 0}
            onClick={() =>
              printLabelSheet(
                buildLabelSheet(
                  printable.map((p) => ({
                    name: p.name,
                    variant: p.variantLabel,
                    price: taka(p.salePrice ?? p.price),
                    barcodeSvg: barcodeSvg(p.barcode),
                  })),
                ),
              )
            }
          >
            Print {printable.length} label{printable.length === 1 ? "" : "s"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Each label prints as its own 40×30mm page. In the print dialog pick
          the label printer; if it asks, choose paper 40×30mm and margins None.
        </p>
      </div>

      {printable.length > 0 && (
        <div className={`${card} mt-5`}>
          <h2 className="mb-3 font-bold">Preview</h2>
          <div className="flex flex-wrap gap-2">
            {printable.map((p, i) => (
              <div
                key={`${key(p)}-${i}`}
                className="border border-dashed border-gray-300 print:border-0"
              >
                <Label p={p} />
              </div>
            ))}
          </div>
        </div>
      )}
    </PosSubPage>
  );
}

/** Draws a barcode into a detached <svg> and returns its markup (null if none / invalid). */
function barcodeSvg(code: string | null | undefined): string | null {
  if (!code) return null;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  try {
    JsBarcode(svg, code, {
      format: /^\d{13}$/.test(code) ? "EAN13" : "CODE128",
      height: 40,
      width: 1.4,
      margin: 0,
      fontSize: 11,
      textMargin: 0,
      displayValue: true,
    });
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
  return svg.outerHTML;
}
