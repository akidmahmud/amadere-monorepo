import type { FlagKey } from "@/hooks/useSalesReportV2";

// Admin palette (spec D10): the demo's layout, green instead of violet.
export const COLORS = {
  green: "#2e7d43",
  greenDeep: "#1d5230",
  greenWash: "#eaf4ec",
  greenLine: "#cfe3d4",
  ink: "#1e2b22",
  ink2: "#374840",
  muted: "#64766b",
  line: "#e5ebe6",
  paper: "#f6f8f6",
  gain: "#0D7A54",
  gainWash: "#E3F3EB",
  loss: "#B3322C",
  lossWash: "#FBE8E6",
  amber: "#93600F",
  amberWash: "#FCF1DC",
  slate: "#475569",
  slateWash: "#EEF1F5",
  blue: "#3B4FC4",
  blueWash: "#ECEEFC",
  barIn: "#A7D3B3",
  barOut: "#E9B7A9",
} as const;

export const STATUS_COLOR: Record<string, string> = {
  Pending: "#E4B45E", Confirmed: "#7F8CE0", Shipped: "#94A3B8", Delivered: "#3DA57D", Returned: "#D96A62", Cancelled: "#BDB8C9",
};

export const STATUS_BADGE: Record<string, { bg: string; fg: string }> = {
  Pending: { bg: COLORS.amberWash, fg: COLORS.amber },
  Confirmed: { bg: COLORS.blueWash, fg: COLORS.blue },
  Shipped: { bg: COLORS.slateWash, fg: COLORS.slate },
  Delivered: { bg: COLORS.gainWash, fg: COLORS.gain },
  Returned: { bg: COLORS.lossWash, fg: COLORS.loss },
  Cancelled: { bg: "#F1F0F4", fg: COLORS.muted },
};

export const FLAG: Record<FlagKey, { label: string; tone: "loss" | "amber" | "info"; action: string }> = {
  loss: { label: "Loss on order", tone: "loss", action: "Check price, discount and delivery charge before repeating this offer." },
  low: { label: "Low contribution", tone: "amber", action: "Small or heavy orders: consider a minimum order or weight-based delivery fee." },
  over: { label: "Courier overcharge", tone: "loss", action: "Raise with the courier and claim the difference in the next settlement." },
  nocourier: { label: "Courier not set", tone: "amber", action: "Set the courier so the agreed rate can be checked." },
  stuck: { label: "Stuck before shipping", tone: "amber", action: "Call the customer, then ship or cancel." },
  nobill: { label: "Courier bill missing", tone: "amber", action: "Import the courier settlement so the real charge replaces the estimate." },
  unconf: { label: "Unconfirmed product cost", tone: "info", action: "Confirm the cost in Rates and costs so profit is final." },
  nocost: { label: "Product cost missing", tone: "loss", action: "Add the cost in Rates and costs; this order is left out of profit." },
};

export const TAG_STYLE: Record<"loss" | "amber" | "info" | "plain", { border: string; bg: string; fg: string }> = {
  loss: { border: "#F0C4BE", bg: COLORS.lossWash, fg: COLORS.loss },
  amber: { border: "#EED9AE", bg: COLORS.amberWash, fg: COLORS.amber },
  info: { border: COLORS.greenLine, bg: COLORS.greenWash, fg: COLORS.greenDeep },
  plain: { border: COLORS.line, bg: "#fff", fg: COLORS.ink2 },
};

export const COURIER_LABEL: Record<string, string> = { STEADFAST: "Steadfast", PATHAO: "Pathao", REDX: "RedX", ECOURIER: "eCourier" };
export const courierLabel = (c: string | null) => (c ? (COURIER_LABEL[c] ?? c) : "Not set");

export function tk(n: number | null | undefined, signed = false): string {
  if (n == null || Number.isNaN(n)) return "-";
  const v = Math.round(n);
  const s = "৳" + Math.abs(v).toLocaleString("en-IN");
  if (v < 0) return "−" + s;
  return signed && v > 0 ? "+" + s : s;
}

export const pc = (n: number) => (!Number.isFinite(n) ? "-" : (Math.round(n * 1000) / 10).toFixed(1) + "%");
export const dmy = (s?: string | null) => (s ? `${s.slice(8, 10)}/${s.slice(5, 7)}/${s.slice(0, 4)}` : "");
export const agentLabel = (name: string | null) => name || "Website (no agent)";

export function csvText(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((r) => r.map((v) => { const s = String(v ?? ""); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(","))
    .join("\n");
}
