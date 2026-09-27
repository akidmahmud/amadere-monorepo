import { useEffect, useRef } from "react";
import { isScanEnd, scanChar, SCAN_GAP_MS } from "@/lib/pos-scan";

/**
 * A USB or wireless scanner "types" the code fast, then presses Enter (or
 * Tab). Keys arriving < SCAN_GAP_MS apart and ending that way with >= 4
 * chars are a scan; a human types slower, so normal typing is unaffected.
 * Characters are read from the physical key, so a Bangla keyboard layout
 * doesn't garble the code (see scanChar).
 * ponytail: timing heuristic only; add camera (ZXing) scanning if a store
 * has no hardware scanner.
 */
export function useScanner(onScan: (code: string) => void, enabled = true) {
  const buf = useRef("");
  const last = useRef(0);
  const recent = useRef<{ code: string; at: number }>({ code: "", at: 0 });
  const handler = useRef(onScan);
  useEffect(() => {
    handler.current = onScan;
  }, [onScan]);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      // A scan into a popup's field (e.g. a new product's barcode) is data
      // entry for that popup, not a sale.
      if ((e.target as Element | null)?.closest?.('[aria-modal="true"]'))
        return;
      const now = performance.now();
      if (now - last.current > SCAN_GAP_MS) buf.current = "";
      last.current = now;
      if (isScanEnd(e.key)) {
        const code = buf.current;
        buf.current = "";
        if (code.length < 4) return;
        e.preventDefault();
        e.stopPropagation();
        // Same label read twice within 1.5s = one scan.
        if (code === recent.current.code && now - recent.current.at < 1500)
          return;
        recent.current = { code, at: now };
        // The scanner also typed into whatever input had focus; the caller
        // clears its own search box (a controlled input can't be reset here).
        handler.current(code);
      } else {
        const ch = scanChar(e);
        if (ch) buf.current += ch;
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [enabled]);
}
