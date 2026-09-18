"use client";
import type { ReportSettings } from "@/hooks/useSalesReportV2";
import { COLORS } from "./format";
import { NumInput } from "./RateCardEditor";

export function OtherCostsCard({
  s,
  disabled,
  onChange,
}: {
  s: ReportSettings;
  disabled: boolean;
  onChange: (next: ReportSettings) => void;
}) {
  const rows: [
    string,
    number,
    (v: number) => ReportSettings,
    string,
    string,
    number?,
  ][] = [
    [
      "Packaging cost per shipped order",
      s.packaging,
      (v) => ({ ...s, packaging: v }),
      "৳",
      "",
    ],
    [
      "bKash fee on advance",
      s.fees.BKASH ?? 0,
      (v) => ({ ...s, fees: { ...s.fees, BKASH: v } }),
      "",
      "%",
      0.01,
    ],
    [
      "Nagad fee on advance",
      s.fees.NAGAD ?? 0,
      (v) => ({ ...s, fees: { ...s.fees, NAGAD: v } }),
      "",
      "%",
      0.01,
    ],
    [
      "Flag low contribution below",
      s.th.low,
      (v) => ({ ...s, th: { ...s.th, low: v } }),
      "৳",
      "",
    ],
    [
      "Courier overcharge tolerance",
      s.th.over,
      (v) => ({ ...s, th: { ...s.th, over: v } }),
      "৳",
      "",
    ],
    [
      "Flag pending or confirmed orders older than",
      s.th.pending,
      (v) => ({ ...s, th: { ...s.th, pending: v } }),
      "",
      "days",
    ],
    [
      "Flag missing courier bill after delivery",
      s.th.bill,
      (v) => ({ ...s, th: { ...s.th, bill: v } }),
      "",
      "days",
    ],
  ];
  return (
    <table className="w-full border-collapse text-[14.5px]">
      <tbody>
        {rows.map(([label, value, apply, pre, post, step]) => (
          <tr
            key={label}
            className="border-t first:border-t-0"
            style={{ borderColor: COLORS.line }}
          >
            <td className="py-1.5">{label}</td>
            <td className="text-right">
              {pre}{" "}
              <NumInput
                value={value}
                step={step}
                disabled={disabled}
                label={label}
                onChange={(v) => onChange(apply(v))}
              />{" "}
              {post}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
