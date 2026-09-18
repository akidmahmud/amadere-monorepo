import type { DayPoint } from "@/hooks/useSalesReportV2";
import { COLORS, tk } from "./format";

export function DailyChart({ data, money }: { data: DayPoint[]; money: boolean }) {
  const W = 560, H = 210, pad = 30;
  const bw = (W - pad - 10) / Math.max(1, data.length);
  const val = (x: DayPoint) => (money ? (x.net ?? 0) : x.grossSales);
  const max = Math.max(1, ...data.map((x) => Math.max(val(x), money ? (x.contrib ?? 0) : 0)));
  const min = Math.min(0, ...data.map((x) => (money ? (x.contrib ?? 0) : 0)));
  const Y = (v: number) => 10 + ((max - v) / (max - min)) * (H - 40);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Daily net sales and contribution">
      {[max, max / 2, 0].map((v) => (
        <g key={v}>
          <line x1={pad} x2={W - 4} y1={Y(v)} y2={Y(v)} stroke={COLORS.line} />
          <text x={pad - 4} y={Y(v) + 4} textAnchor="end" fontSize={11} fill={COLORS.muted}>
            {v >= 1000 ? `${Math.round(v / 1000)}k` : Math.round(v)}
          </text>
        </g>
      ))}
      {data.map((x, i) => {
        const X0 = pad + i * bw + bw * 0.14, w = bw * 0.72, c = x.contrib ?? 0;
        const showLabel = data.length <= 10 || i % Math.ceil(data.length / 10) === 0;
        return (
          <g key={x.date}>
            <rect x={X0} y={Y(val(x))} width={w} height={Math.max(0, Y(0) - Y(val(x)))} fill={COLORS.barIn} rx={2}>
              <title>{`${x.date} net sales ${tk(val(x))}`}</title>
            </rect>
            {money && (
              <rect x={X0 + w * 0.22} y={Y(Math.max(0, c))} width={w * 0.56} height={Math.max(0, Y(Math.min(0, c)) - Y(Math.max(0, c)))}
                fill={c < 0 ? COLORS.loss : COLORS.gain} rx={2}>
                <title>{`${x.date} contribution ${tk(c)}`}</title>
              </rect>
            )}
            {showLabel && (
              <text x={X0 + w / 2} y={H - 10} textAnchor="middle" fontSize={12} fill={COLORS.muted}>
                {`${x.date.slice(8, 10)}/${x.date.slice(5, 7)}`}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
