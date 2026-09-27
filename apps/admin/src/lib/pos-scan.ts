/**
 * The character a barcode scanner meant, from the PHYSICAL key it pressed.
 * A USB/wireless scanner is a keyboard: with a Bangla (or any non-US)
 * keyboard layout active, `e.key` comes out as Bangla letters and the code
 * never matches. `e.code` ("KeyA", "Digit1", "Numpad1") ignores the layout.
 */
export function scanChar(e: {
  key: string;
  code: string;
  shiftKey: boolean;
}): string | null {
  const letter = /^Key([A-Z])$/.exec(e.code);
  if (letter) return e.shiftKey ? letter[1] : letter[1].toLowerCase();
  const digit = /^(?:Digit|Numpad)(\d)$/.exec(e.code);
  if (digit && !(e.shiftKey && e.code.startsWith("Digit"))) return digit[1];
  if (e.code === "Minus" && !e.shiftKey) return "-";
  if (e.code === "NumpadSubtract") return "-";
  if (e.code === "Period" || e.code === "NumpadDecimal") return ".";
  if (e.code === "Slash" && !e.shiftKey) return "/";
  // Anything else: trust the layout only for plain ASCII.
  return e.key.length === 1 && e.key < "\u007f" ? e.key : null;
}

/** Scanners end a code with Enter (default) or Tab (some models). */
export const isScanEnd = (key: string) => key === "Enter" || key === "Tab";

/** Max gap between a scanner's keystrokes; wireless ones are slower than USB. */
export const SCAN_GAP_MS = 60;
