"use client";

import { confirmDialog } from "@/components/PosConfirm";
import { barcodeSvg } from "@/lib/pos-barcode";
import {
  DEFAULT_LABEL_SIZE,
  buildLabelSheet,
  labelSizeText,
  printLabelSheet,
} from "@/lib/pos-labels";
import Link from "next/link";
import { useState } from "react";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { posLookup, usePosLabelSize, useStockPost } from "@/hooks/usePos";
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
  const { storeId, can } = usePosContext();
  const size = usePosLabelSize().data ?? DEFAULT_LABEL_SIZE;
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const generate = useStockPost<
    { productIds: number[]; replaceLegacy?: boolean },
    { generated: number }
  >("/admin/stock/barcodes/generate");
  const missing = rows.filter((r) => !r.p.barcode);
  // Our own pre-2026-09-28 codes: long Code 128, borderline on a 40mm label.
  const legacy = rows.filter((r) => /^AMD\d{11}$/.test(r.p.barcode ?? ""));

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
          {legacy.length > 0 && (
            <button
              className="h-10 rounded-lg border border-amber-600 px-4 text-sm font-bold text-amber-700"
              disabled={generate.isPending}
              title="Old AMD… codes are long and can be hard to scan on small labels"
              onClick={async () =>
                (await confirmDialog({
                  title: `Give ${legacy.length} product(s) a new barcode?`,
                  message:
                    "The new codes are easier to scan. Labels already printed with the old AMD… code will stop scanning — reprint them after this.",
                  confirmLabel: "Switch barcodes",
                  icon: "barcode",
                })) &&
                generate.mutate(
                  {
                    productIds: [...new Set(legacy.map((r) => r.p.productId))],
                    replaceLegacy: true,
                  },
                  {
                    onSuccess: async (r) => {
                      toast.push(
                        `${r.generated} barcode(s) switched to the new format`,
                        "success",
                      );
                      await refresh();
                    },
                    onError: (e) => toast.push(e.message),
                  },
                )
              }
            >
              Switch {legacy.length} old barcode
              {legacy.length > 1 ? "s" : ""} to the new format
            </button>
          )}
          <button
            className={primaryBtn}
            disabled={printable.length === 0}
            onClick={() =>
              printLabelSheet(
                buildLabelSheet(
                  printable.map((p) => ({
                    barcodeSvg: barcodeSvg(p.barcode),
                    name: p.name,
                    size: labelSizeText(p),
                  })),
                  size,
                ),
              )
            }
          >
            Print {printable.length} label{printable.length === 1 ? "" : "s"}
          </button>
        </div>
        <p className="text-xs text-gray-500">
          Each label prints as its own {size.widthMm}×{size.heightMm}mm page (
          {[
            (size.showName ?? true) ? "name" : "",
            (size.showSize ?? true) ? "size" : "",
            "barcode",
          ]
            .filter(Boolean)
            .join(", ")}
          ). In the print dialog pick the label printer; if it asks, choose
          paper {size.widthMm}×{size.heightMm}mm and margins None.
          {can("pos.settings") && (
            <>
              {" "}
              Change the size in{" "}
              <Link
                href="/pos/settings"
                className="font-semibold text-[#1d7a46]"
              >
                Settings › Labels
              </Link>
              .
            </>
          )}
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
                <Label p={p} size={size} />
              </div>
            ))}
          </div>
        </div>
      )}
    </PosSubPage>
  );
}
