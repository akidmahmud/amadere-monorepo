import type { FlagKey } from "@/hooks/useSalesReportV2";
import { FLAG, STATUS_BADGE, TAG_STYLE } from "./format";

export function StatusBadge({ status }: { status: string }) {
  const s = STATUS_BADGE[status];
  return (
    <span
      className="inline-block whitespace-nowrap rounded-[5px] px-[7px] text-[12.5px] font-medium leading-5"
      style={{ background: s?.bg, color: s?.fg }}
    >
      {status}
    </span>
  );
}

export function Tag({
  tone = "plain",
  children,
}: {
  tone?: "loss" | "amber" | "info" | "plain";
  children: React.ReactNode;
}) {
  const t = TAG_STYLE[tone];
  return (
    <span
      className="mr-[3px] my-px inline-block whitespace-nowrap rounded-[5px] border px-1.5 text-xs leading-[18px]"
      style={{ borderColor: t.border, background: t.bg, color: t.fg }}
    >
      {children}
    </span>
  );
}

export const FlagTag = ({ flag }: { flag: FlagKey }) => (
  <Tag tone={FLAG[flag].tone}>{FLAG[flag].label}</Tag>
);
