"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { usePosLabelSize } from "@/hooks/usePos";
import { card, input, primaryBtn } from "./PosSubPage";

const PRESETS = [
  [38, 25],
  [40, 30],
  [50, 25],
  [50, 30],
] as const;

/** POS Settings › Labels: the label printer's paper size. */
export function PosLabelSettingsTab() {
  const { data } = usePosLabelSize();
  return data ? (
    <Form
      key={`${data.widthMm}x${data.heightMm}:${data.showName}:${data.showSize}`}
      {...data}
    />
  ) : null;
}

function Form(initial: {
  widthMm: number;
  heightMm: number;
  showName?: boolean;
  showSize?: boolean;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const [w, setW] = useState(String(initial.widthMm));
  const [h, setH] = useState(String(initial.heightMm));
  const [showName, setShowName] = useState(initial.showName ?? true);
  const [showSize, setShowSize] = useState(initial.showSize ?? true);
  const wn = Number(w);
  const hn = Number(h);
  const valid = wn >= 20 && wn <= 120 && hn >= 10 && hn <= 120;
  const save = useMutation({
    mutationFn: () =>
      proxyFetch("/admin/pos/settings/label", {
        method: "PUT",
        body: JSON.stringify({
          widthMm: wn,
          heightMm: hn,
          showName,
          showSize,
        }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-label-size"] });
      toast.push("Label settings saved", "success");
    },
    onError: (e) => toast.push(e.message),
  });
  return (
    <div className={`${card} max-w-xl space-y-4`}>
      <div>
        <h2 className="font-bold">Barcode label size</h2>
        <p className="text-sm text-gray-600">
          The size of one sticker on your label roll, and what is printed on it.
          The barcode is always printed.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map(([pw, ph]) => (
          <button
            key={`${pw}x${ph}`}
            onClick={() => {
              setW(String(pw));
              setH(String(ph));
            }}
            className={`h-9 rounded-lg border px-3 text-sm font-semibold ${wn === pw && hn === ph ? "border-[#1d7a46] bg-emerald-50 text-[#1d7a46]" : "border-gray-200"}`}
          >
            {pw} × {ph} mm
          </button>
        ))}
      </div>
      <div className="flex items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold">Width (mm)</span>
          <input
            className={`${input} w-28`}
            inputMode="decimal"
            value={w}
            onChange={(e) => setW(e.target.value)}
          />
        </label>
        <span className="pb-2.5 text-gray-400">×</span>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold">Height (mm)</span>
          <input
            className={`${input} w-28`}
            inputMode="decimal"
            value={h}
            onChange={(e) => setH(e.target.value)}
          />
        </label>
      </div>
      <div className="space-y-2 border-t border-gray-100 pt-4">
        <h3 className="text-sm font-bold">Printed on the label</h3>
        {(
          [
            ["Product name", showName, setShowName],
            ["Size (e.g. 1KG, 500 g)", showSize, setShowSize],
          ] as const
        ).map(([text, on, set]) => (
          <label
            key={text}
            className="flex cursor-pointer items-center justify-between rounded-xl border border-gray-200 px-4 py-3"
          >
            <span className="text-sm font-semibold">{text}</span>
            <input
              type="checkbox"
              role="switch"
              checked={on}
              onChange={(e) => set(e.target.checked)}
              aria-label={text}
              className="peer sr-only"
            />
            <span
              aria-hidden
              className={`relative h-6 w-11 rounded-full transition ${on ? "bg-[#1d7a46]" : "bg-gray-300"}`}
            >
              <span
                className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`}
              />
            </span>
          </label>
        ))}
        <p className="text-xs text-gray-500">
          Barcode is always printed. Turn both off for barcode-only labels.
        </p>
      </div>
      {!valid && (
        <p className="text-xs text-red-600">
          Width 20–120 mm, height 10–120 mm.
        </p>
      )}
      <button
        className={primaryBtn}
        disabled={!valid || save.isPending}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
