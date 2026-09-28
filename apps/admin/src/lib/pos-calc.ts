/** Tiny till calculator state machine (no eval). */
export type CalcOp = "+" | "−" | "×" | "÷";
export interface CalcState {
  cur: string; // what is being typed ("" = nothing yet)
  prev: number | null; // left operand
  op: CalcOp | null;
  done: boolean; // just pressed "=" — the next digit starts fresh
  error: boolean;
}
export const CALC_START: CalcState = {
  cur: "",
  prev: null,
  op: null,
  done: false,
  error: false,
};

const round = (n: number) => parseFloat(n.toFixed(10));
function apply(a: number, op: CalcOp, b: number): number | null {
  if (op === "+") return round(a + b);
  if (op === "−") return round(a - b);
  if (op === "×") return round(a * b);
  return b === 0 ? null : round(a / b);
}

/** key: "0"-"9", ".", "+", "−", "×", "÷", "=", "%", "C", "⌫". */
export function calcPress(s: CalcState, key: string): CalcState {
  if (key === "C") return CALC_START;
  if (s.error)
    return key >= "0" && key <= "9" ? { ...CALC_START, cur: key } : s;
  if (/^\d$/.test(key)) {
    const cur = s.done ? "" : s.cur;
    if (cur.replace(/[^\d]/g, "").length >= 12) return s;
    return { ...s, cur: cur === "0" ? key : cur + key, done: false };
  }
  if (key === ".") {
    const cur = s.done ? "" : s.cur;
    return cur.includes(".")
      ? s
      : { ...s, cur: (cur || "0") + ".", done: false };
  }
  if (key === "⌫") return s.done ? s : { ...s, cur: s.cur.slice(0, -1) };
  if (key === "%")
    return s.cur ? { ...s, cur: String(round(Number(s.cur) / 100)) } : s;
  if (key === "+" || key === "−" || key === "×" || key === "÷") {
    if (s.prev !== null && s.op && s.cur !== "") {
      const r = apply(s.prev, s.op, Number(s.cur));
      return r === null
        ? { ...CALC_START, error: true }
        : { cur: "", prev: r, op: key, done: false, error: false };
    }
    const left = s.cur !== "" ? Number(s.cur) : (s.prev ?? 0);
    return { cur: "", prev: left, op: key, done: false, error: false };
  }
  if (key === "=") {
    if (s.prev === null || !s.op || s.cur === "") return s;
    const r = apply(s.prev, s.op, Number(s.cur));
    return r === null
      ? { ...CALC_START, error: true }
      : { cur: String(r), prev: null, op: null, done: true, error: false };
  }
  return s;
}

/** Big number on the display. */
export const calcDisplay = (s: CalcState) =>
  s.error
    ? "Error"
    : s.cur !== ""
      ? s.cur
      : s.prev !== null
        ? String(s.prev)
        : "0";
