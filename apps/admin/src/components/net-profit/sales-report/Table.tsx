import { COLORS } from "./format";

export type Col = { h: string; num?: boolean };

export function ReportTable({ cols, rows, foot, empty }: { cols: Col[]; rows: React.ReactNode[][]; foot?: React.ReactNode[]; empty?: string }) {
  const cell = (num?: boolean) => `border-b px-3 py-2 align-top ${num ? "text-right tabular-nums whitespace-nowrap" : ""}`;
  if (rows.length === 0) return <div className="rounded-xl border bg-white p-7 text-center" style={{ borderColor: COLORS.line, color: COLORS.ink2 }}>{empty ?? "Nothing in this period."}</div>;
  return (
    <div className="overflow-x-auto rounded-xl border bg-white" style={{ borderColor: COLORS.line }}>
      <table className="w-full border-collapse text-[14.5px]">
        <thead><tr style={{ background: "#fbfcfb", color: COLORS.muted }}>{cols.map((c) => <th key={c.h} className={`${cell(c.num)} text-[13.5px] font-medium ${c.num ? "" : "text-left"}`} style={{ borderColor: COLORS.line }}>{c.h}</th>)}</tr></thead>
        <tbody>{rows.map((r, i) => <tr key={i}>{r.map((v, j) => <td key={j} className={cell(cols[j]?.num)} style={{ borderColor: COLORS.line }}>{v}</td>)}</tr>)}</tbody>
        {foot && <tfoot><tr className="font-semibold" style={{ background: "#fbfcfb" }}>{foot.map((v, j) => <td key={j} className={cell(cols[j]?.num)} style={{ borderColor: COLORS.line }}>{v}</td>)}</tr></tfoot>}
      </table>
    </div>
  );
}

export const Small = ({ children }: { children: React.ReactNode }) => <div className="text-[13px]" style={{ color: COLORS.muted }}>{children}</div>;
