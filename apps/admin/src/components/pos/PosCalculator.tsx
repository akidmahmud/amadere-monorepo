"use client";

import { useEffect, useState } from "react";
import { Icon } from "@amader/admin-ui";
import { CALC_START, calcDisplay, calcPress } from "@/lib/pos-calc";

const KEYS: [string, "fn" | "op" | "num" | "eq"][] = [
  ["C", "fn"],
  ["⌫", "fn"],
  ["%", "fn"],
  ["÷", "op"],
  ["7", "num"],
  ["8", "num"],
  ["9", "num"],
  ["×", "op"],
  ["4", "num"],
  ["5", "num"],
  ["6", "num"],
  ["−", "op"],
  ["1", "num"],
  ["2", "num"],
  ["3", "num"],
  ["+", "op"],
  ["0", "num"],
  [".", "num"],
  ["=", "eq"],
];

// Physical keyboard → calculator key.
const KEYBOARD: Record<string, string> = {
  "+": "+",
  "-": "−",
  "*": "×",
  x: "×",
  "/": "÷",
  "=": "=",
  Enter: "=",
  "%": "%",
  ".": ".",
  ",": ".",
  Backspace: "⌫",
  Delete: "C",
  c: "C",
};

/** A small calculator popup for the counter (change, bulk prices…). */
export function PosCalculator({ onClose }: { onClose: () => void }) {
  const [s, setS] = useState(CALC_START);
  const press = (k: string) => setS((x) => calcPress(x, k));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") return onClose();
      const k = /^\d$/.test(e.key) ? e.key : KEYBOARD[e.key];
      if (!k) return;
      e.preventDefault();
      e.stopPropagation(); // not a barcode scan, not a till shortcut
      setS((x) => calcPress(x, k));
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [onClose]);

  const display = calcDisplay(s);
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-black/30 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Calculator"
      onClick={onClose}
    >
      <div
        className="w-[300px] rounded-3xl bg-white p-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <span className="flex items-center gap-2 text-sm font-bold text-gray-700">
            <Icon name="calculate" size={20} className="text-[#1d7a46]" />
            Calculator
          </span>
          <button
            onClick={onClose}
            aria-label="Close calculator"
            className="grid h-8 w-8 place-items-center rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <Icon name="close" size={20} />
          </button>
        </div>
        <div className="mb-3 rounded-2xl bg-gradient-to-br from-[#1d7a46] to-[#145c33] px-4 py-3 text-right text-white">
          <div className="h-5 text-sm text-emerald-100/80">
            {s.prev !== null && s.op ? `${s.prev} ${s.op}` : ""}
          </div>
          <div
            className={`truncate font-extrabold tabular-nums ${display.length > 10 ? "text-2xl" : "text-4xl"}`}
            aria-live="polite"
          >
            {display}
          </div>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {KEYS.map(([k, kind]) => (
            <button
              key={k}
              onClick={() => press(k)}
              className={`h-14 rounded-2xl text-xl font-bold transition active:scale-95 ${
                kind === "num"
                  ? "bg-gray-50 text-gray-900 hover:bg-gray-100"
                  : kind === "op"
                    ? `${s.op === k && s.cur === "" ? "bg-[#1d7a46] text-white" : "bg-emerald-50 text-[#1d7a46] hover:bg-emerald-100"}`
                    : kind === "eq"
                      ? "col-span-2 bg-[#1d7a46] text-white hover:bg-[#186a3c]"
                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {k}
            </button>
          ))}
        </div>
        <p className="mt-3 text-center text-[11px] text-gray-400">
          Keyboard works too · Esc to close
        </p>
      </div>
    </div>
  );
}
