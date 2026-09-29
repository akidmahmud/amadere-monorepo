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
    <Form key={`${data.widthMm}x${data.heightMm}`} {...data} />
  ) : null;
}

function Form(initial: { widthMm: number; heightMm: number }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [w, setW] = useState(String(initial.widthMm));
  const [h, setH] = useState(String(initial.heightMm));
  const wn = Number(w);
  const hn = Number(h);
  const valid = wn >= 20 && wn <= 120 && hn >= 10 && hn <= 120;
  const save = useMutation({
    mutationFn: () =>
      proxyFetch("/admin/pos/settings/label", {
        method: "PUT",
        body: JSON.stringify({ widthMm: wn, heightMm: hn }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-label-size"] });
      toast.push("Label size saved", "success");
    },
    onError: (e) => toast.push(e.message),
  });
  return (
    <div className={`${card} max-w-xl space-y-4`}>
      <div>
        <h2 className="font-bold">Barcode label size</h2>
        <p className="text-sm text-gray-600">
          The size of one sticker on your label roll. Labels print the barcode
          only, centred on the sticker.
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
        <button
          className={primaryBtn}
          disabled={!valid || save.isPending}
          onClick={() => save.mutate()}
        >
          Save
        </button>
      </div>
      {!valid && (
        <p className="text-xs text-red-600">
          Width 20–120 mm, height 10–120 mm.
        </p>
      )}
    </div>
  );
}
