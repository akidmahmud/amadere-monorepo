"use client";
import { useEffect } from "react";
import { useReportOverview, type Summary } from "@/hooks/useSalesReportV2";
import { COLORS, STATUS_COLOR, pc, tk } from "./format";
import { DailyChart } from "./DailyChart";
import type { TabProps } from "./ReportFilters";

const STATUSES = [
  "Pending",
  "Confirmed",
  "Shipped",
  "Delivered",
  "Returned",
  "Cancelled",
] as const;

export function Panel({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className="rounded-xl border bg-white px-[18px] py-4"
      style={{ borderColor: COLORS.line }}
    >
      <h2 className="text-lg font-semibold" style={{ color: COLORS.ink }}>
        {title}
      </h2>
      {hint && (
        <p
          className="mb-3 mt-0.5 text-[13.5px]"
          style={{ color: COLORS.muted }}
        >
          {hint}
        </p>
      )}
      {children}
    </section>
  );
}

function Ledger({ s, basis }: { s: Summary; basis: string }) {
  const steps: [string, number][] = [
    ["Net sales", s.net ?? 0],
    ["Delivery charged to customers", s.deliveryPaid ?? 0],
    ["Courier charges", -(s.courierCost ?? 0)],
    ["Product cost", -(s.cogs ?? 0)],
    ["Packaging and payment fees", -((s.packaging ?? 0) + (s.fee ?? 0))],
    ["Returned order losses", -(s.retLoss ?? 0)],
  ];
  let run = 0;
  const pts = [0, ...steps.map(([, v]) => (run += v))];
  const lo = Math.min(0, ...pts),
    hi = Math.max(1, ...pts);
  const P = (x: number) => ((x - lo) / (hi - lo)) * 100;
  run = 0;
  const c = s.contrib ?? 0;
  const track = {
    background: `repeating-linear-gradient(90deg,transparent 0 calc(25% - 1px),${COLORS.line} calc(25% - 1px) 25%)`,
  };
  const Row = ({
    label,
    a,
    b,
    kind,
    value,
    total,
  }: {
    label: React.ReactNode;
    a: number;
    b: number;
    kind: string;
    value: number;
    total?: boolean;
  }) => {
    const left = P(Math.min(a, b));
    const width = Math.max(P(Math.max(a, b)) - left, value ? 0.5 : 0);
    const bg =
      kind === "in"
        ? COLORS.barIn
        : kind === "out"
          ? COLORS.barOut
          : value < 0
            ? COLORS.loss
            : COLORS.gain;
    return (
      <div
        className={`grid items-center gap-3 ${total ? "mt-1 border-t pt-2.5" : ""}`}
        style={{
          gridTemplateColumns: "minmax(150px,210px) 1fr 104px",
          borderColor: COLORS.line,
        }}
      >
        <span
          className="text-[14.5px]"
          style={{
            color: total ? COLORS.ink : COLORS.ink2,
            fontWeight: total ? 600 : 400,
          }}
        >
          {label}
        </span>
        <span className="relative h-[22px]" style={track}>
          <i
            className="absolute bottom-[3px] top-[3px] rounded-[3px]"
            style={{ left: `${left}%`, width: `${width}%`, background: bg }}
          />
        </span>
        <span
          className="text-right tabular-nums"
          style={{
            color: value < 0 ? COLORS.loss : total ? COLORS.gain : COLORS.ink,
            fontSize: total ? 19 : 15,
            fontWeight: total ? 700 : 400,
          }}
        >
          {tk(value)}
        </span>
      </div>
    );
  };
  return (
    <Panel
      title="Where the money went"
      hint={`${s.dN} delivered and ${s.rN} returned order(s), ${basis === "order" ? "booked" : "closed"} in this period`}
    >
      <div className="mt-1.5 grid gap-[7px]">
        {steps.map(([label, v]) => {
          const a = run,
            b = (run += v);
          return (
            <Row
              key={label}
              label={label}
              a={a}
              b={b}
              kind={v >= 0 ? "in" : "out"}
              value={v}
            />
          );
        })}
        <Row
          label={
            <>
              Gross contribution
              <div
                className="text-[13px] font-normal"
                style={{ color: COLORS.muted }}
              >
                {pc(s.margin ?? 0)} of net sales
              </div>
            </>
          }
          a={Math.min(0, c)}
          b={Math.max(0, c)}
          kind="res"
          value={c}
          total
        />
      </div>
      <div
        className="mt-3.5 flex flex-wrap items-baseline gap-3 rounded-lg px-3 py-2 text-sm"
        style={{ background: COLORS.amberWash, color: COLORS.amber }}
      >
        Delivery subsidy{" "}
        <b className="text-[17px] tabular-nums">{tk(s.subsidy ?? 0)}</b>
        <span>
          Couriers charged {tk(s.courierCost ?? 0)}, customers paid{" "}
          {tk(s.deliveryPaid ?? 0)}. That is {pc(c ? (s.subsidy ?? 0) / c : 0)}{" "}
          of contribution.
        </span>
      </div>
      {s.missing > 0 && (
        <div className="mt-2 text-[13px]" style={{ color: COLORS.loss }}>
          {s.missing} delivered order(s) are missing a product cost or a courier
          charge and are left out. See Exceptions.
        </div>
      )}
      {s.est > 0 && (
        <div className="mt-1.5 text-[13px]" style={{ color: COLORS.muted }}>
          {s.est} courier charge(s) are estimates from the rate card until the
          courier bill is imported.
        </div>
      )}
    </Panel>
  );
}

function AgentPanel({ s, basis }: { s: Summary; basis: string }) {
  const Metric = ({
    k,
    v,
    d,
  }: {
    k: string;
    v: string | number;
    d?: string;
  }) => (
    <div className="px-4 py-3">
      <div className="text-[13.5px]" style={{ color: COLORS.muted }}>
        {k}
      </div>
      <div className="text-[21px] font-semibold tabular-nums">{v}</div>
      {d && (
        <div className="text-[13px]" style={{ color: COLORS.ink2 }}>
          {d}
        </div>
      )}
    </div>
  );
  return (
    <Panel
      title="Your sales"
      hint={`Orders assigned to you, ${basis === "order" ? "booked" : "closed"} in this period`}
    >
      <div className="grid grid-cols-1 sm:grid-cols-3">
        <Metric
          k="Delivered sales"
          v={tk(s.grossSales)}
          d={`${s.st.Delivered} orders`}
        />
        <Metric
          k="Average order"
          v={tk(s.st.Delivered ? s.grossSales / s.st.Delivered : 0)}
        />
        <Metric
          k="Still to deliver"
          v={s.st.Pending + s.st.Confirmed + s.st.Shipped}
          d="pending, confirmed or shipped"
        />
      </div>
      <p className="mt-2.5 text-[13px]" style={{ color: COLORS.muted }}>
        Costs, courier charges and contribution are visible to managers and
        admins only.
      </p>
    </Panel>
  );
}

function Funnel({ s, basis }: { s: Summary; basis: string }) {
  const max = Math.max(1, ...STATUSES.map((x) => s.st[x]));
  return (
    <Panel
      title={`${basis === "order" ? "Orders booked" : "Orders closed"}: ${s.n}`}
      hint={
        basis === "order"
          ? "Where each order booked in this period stands now"
          : "Delivered or returned in this period"
      }
    >
      <div className="mt-1.5 grid gap-2">
        {STATUSES.map((x) => (
          <div
            key={x}
            className="grid items-center gap-2.5 text-[14.5px]"
            style={{ gridTemplateColumns: "86px 1fr 38px" }}
          >
            <span>{x}</span>
            <span
              className="relative h-3 overflow-hidden rounded-[3px]"
              style={{ background: COLORS.slateWash }}
            >
              <i
                className="absolute inset-y-0 left-0 rounded-[3px]"
                style={{
                  width: `${(s.st[x] / max) * 100}%`,
                  background: STATUS_COLOR[x],
                }}
              />
            </span>
            <span className="text-right tabular-nums">{s.st[x]}</span>
          </div>
        ))}
      </div>
      <div
        className="mt-3 border-t pt-2.5 text-sm"
        style={{ borderColor: COLORS.line, color: COLORS.ink2 }}
      >
        Cancelled or returned: <b>{pc(s.lossRate)}</b> of closed orders
        <br />
        New customers {s.newN}, repeat {s.repN}
      </div>
    </Panel>
  );
}

function MetricStrip({
  s,
  overTolerance,
}: {
  s: Summary;
  overTolerance?: number;
}) {
  const items: [string, string, string, boolean?][] = [
    ["Average delivered order", tk(s.aov ?? 0), "net sales per order"],
    [
      "Contribution per order",
      tk(s.dN ? (s.contrib ?? 0) / s.dN : 0),
      "after courier and product cost",
      s.dN > 0 && (s.contrib ?? 0) < 0,
    ],
    [
      "Subsidy per order",
      tk(s.dN ? (s.subsidy ?? 0) / s.dN : 0),
      "courier charge minus delivery paid",
    ],
    [
      "Courier overcharge",
      tk(s.overPos ?? 0),
      `${s.overN ?? 0} order(s) above ৳${overTolerance ?? 5} tolerance`,
      (s.overPos ?? 0) > 0,
    ],
  ];
  return (
    <div
      className="grid rounded-xl border bg-white"
      style={{
        borderColor: COLORS.line,
        gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))",
      }}
    >
      {items.map(([k, v, d, neg]) => (
        <div
          key={k}
          className="border-r px-4 py-3 last:border-r-0"
          style={{ borderColor: COLORS.line }}
        >
          <div className="text-[13.5px]" style={{ color: COLORS.muted }}>
            {k}
          </div>
          <div
            className="text-[21px] font-semibold tabular-nums"
            style={{ color: neg ? COLORS.loss : COLORS.ink }}
          >
            {v}
          </div>
          <div className="text-[13px]" style={{ color: COLORS.ink2 }}>
            {d}
          </div>
        </div>
      ))}
    </div>
  );
}

export function OverviewTab({ f, money, onExport }: TabProps) {
  const { data, isLoading } = useReportOverview(f);
  useEffect(() => {
    if (!data) return onExport("sales-by-channel", null);
    onExport("sales-by-channel", [
      [
        "Channel",
        "Orders booked",
        "Delivered",
        "Net sales",
        ...(money ? ["Contribution", "Margin"] : []),
      ],
      ...data.channels.map((r) => [
        r.channel,
        r.s.n,
        r.s.dN,
        Math.round(money ? (r.s.net ?? 0) : r.s.grossSales),
        ...(money ? [Math.round(r.s.contrib ?? 0), pc(r.s.margin ?? 0)] : []),
      ]),
    ]);
  }, [data, money, onExport]);
  if (isLoading || !data)
    return (
      <div className="p-7 text-center" style={{ color: COLORS.ink2 }}>
        Loading…
      </div>
    );
  const s = data.summary;
  const tot = s;
  return (
    <div className="flex flex-col gap-3.5">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        {money ? (
          <Ledger s={s} basis={f.basis} />
        ) : (
          <AgentPanel s={s} basis={f.basis} />
        )}
        <Funnel s={s} basis={f.basis} />
      </div>
      {money && <MetricStrip s={s} />}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-3.5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <Panel
          title="By day"
          hint={`Delivered net sales${money ? " and contribution" : ""}, by ${f.basis === "order" ? "order" : "delivered"} date. Recent booking days fill in as orders are delivered.`}
        >
          <div
            className="mb-1 flex gap-3.5 text-[13px]"
            style={{ color: COLORS.ink2 }}
          >
            <span>
              <i
                className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]"
                style={{ background: COLORS.barIn }}
              />
              Net sales
            </span>
            {money && (
              <span>
                <i
                  className="mr-1.5 inline-block h-2.5 w-2.5 rounded-sm align-[-1px]"
                  style={{ background: COLORS.gain }}
                />
                Contribution
              </span>
            )}
          </div>
          <DailyChart data={data.daily} money={money} />
        </Panel>
        <Panel
          title="By channel"
          hint="Revenue rank and contribution rank are often different"
        >
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[14.5px]">
              <thead>
                <tr
                  className="text-left text-[13.5px]"
                  style={{ color: COLORS.muted }}
                >
                  <th className="py-2 font-medium">Channel</th>
                  <th className="text-right font-medium">Orders</th>
                  <th className="text-right font-medium">Delivered</th>
                  <th className="text-right font-medium">Net sales</th>
                  {money && (
                    <>
                      <th className="text-right font-medium">Contribution</th>
                      <th className="text-right font-medium">Margin</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody>
                {data.channels.map((r) => (
                  <tr
                    key={r.channel}
                    className="border-t"
                    style={{ borderColor: COLORS.line }}
                  >
                    <td className="py-2">{r.channel}</td>
                    <td className="text-right tabular-nums">{r.s.n}</td>
                    <td className="text-right tabular-nums">
                      {r.s.st.Delivered}
                    </td>
                    <td className="text-right tabular-nums">
                      {tk(money ? (r.s.net ?? 0) : r.s.grossSales)}
                    </td>
                    {money && (
                      <>
                        <td
                          className="text-right tabular-nums"
                          style={{
                            color:
                              (r.s.contrib ?? 0) < 0 ? COLORS.loss : undefined,
                          }}
                        >
                          {tk(r.s.contrib ?? 0)}
                        </td>
                        <td className="text-right tabular-nums">
                          {r.s.net ? pc(r.s.margin ?? 0) : "-"}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr
                  className="border-t font-semibold"
                  style={{ borderColor: COLORS.line }}
                >
                  <td className="py-2">Total</td>
                  <td className="text-right tabular-nums">{tot.n}</td>
                  <td className="text-right tabular-nums">
                    {tot.st.Delivered}
                  </td>
                  <td className="text-right tabular-nums">
                    {tk(money ? (tot.net ?? 0) : tot.grossSales)}
                  </td>
                  {money && (
                    <>
                      <td className="text-right tabular-nums">
                        {tk(tot.contrib ?? 0)}
                      </td>
                      <td className="text-right tabular-nums">
                        {pc(tot.margin ?? 0)}
                      </td>
                    </>
                  )}
                </tr>
              </tfoot>
            </table>
          </div>
        </Panel>
      </div>
    </div>
  );
}
