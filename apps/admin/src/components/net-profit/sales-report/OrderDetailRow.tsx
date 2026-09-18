import type { OrderRow } from "@/hooks/useSalesReportV2";
import { COLORS, FLAG, agentLabel, courierLabel, dmy, tk } from "./format";
import { FlagTag } from "./Tags";

const Kv = ({ rows }: { rows: [React.ReactNode, React.ReactNode, boolean?][] }) => (
  <div className="grid gap-x-3 gap-y-[3px] text-sm" style={{ gridTemplateColumns: "1fr auto" }}>
    {rows.map(([k, v, total], i) => (
      <div key={i} className="contents">
        <span className={total ? "border-t pt-1 font-semibold" : ""} style={{ borderColor: COLORS.line }}>{k}</span>
        <span className={`text-right tabular-nums ${total ? "border-t pt-1 font-semibold" : ""}`} style={{ borderColor: COLORS.line }}>{v}</span>
      </div>
    ))}
  </div>
);

export function OrderDetail({ c, money, overTolerance = 5 }: { c: OrderRow; money: boolean; overTolerance?: number }) {
  const o = c.o;
  const neg = (n: number | null | undefined) => <span style={{ color: COLORS.loss }}>{tk(n == null ? null : -n)}</span>;
  let moneyBlock: React.ReactNode = null;
  if (money) {
    const contrib =
      o.status === "Delivered" ? (
        <><h3 className="mb-1.5 text-[14.5px] font-semibold">Contribution</h3>
          <Kv rows={[
            ["Net sales", tk(c.netSales)], ["Delivery paid by customer", tk(o.delivery ?? 0)],
            [`Courier charge${c.estimated ? " (estimate)" : ""}`, neg(c.courierCharge)],
            ["Product cost", c.cogs == null ? <span style={{ color: COLORS.loss }}>missing</span> : neg(c.cogs)],
            ["Packaging", tk(-(c.packaging ?? 0))], ["Payment fee", tk(-(c.fee ?? 0))],
            ["Contribution", <span key="c" style={{ color: (c.contribution ?? 0) < 0 ? COLORS.loss : COLORS.gain }}>{c.contribution == null ? "-" : tk(c.contribution)}</span>, true],
          ]} /></>
      ) : o.status === "Returned" ? (
        <><h3 className="mb-1.5 text-[14.5px] font-semibold">Contribution</h3>
          <Kv rows={[["Sale reversed", tk(0)], ["Courier charge on return", neg(c.courierCharge)], ["Packaging", tk(-(c.packaging ?? 0))], ["Contribution", <span key="c" style={{ color: COLORS.loss }}>{tk(c.contribution ?? 0)}</span>, true]]} />
          <p className="text-[13px]" style={{ color: COLORS.muted }}>Product goes back to stock, so product cost is not charged.</p></>
      ) : (
        <><h3 className="mb-1.5 text-[14.5px] font-semibold">Contribution</h3>
          <p className="text-[13px]" style={{ color: COLORS.muted }}>Not counted yet. {o.status === "Cancelled" ? "Cancelled before shipping, so nothing to count." : "Contribution is counted when the order is delivered."}</p></>
      );
    moneyBlock = (
      <>{contrib}
        <h3 className="mb-1.5 mt-3 text-[14.5px] font-semibold">Courier check</h3>
        <Kv rows={[
          ["Courier, zone", <>{o.courier ? courierLabel(o.courier) : <span style={{ color: COLORS.loss }}>not set</span>}, {c.zone}</>],
          [`Rate card (${c.weight} kg)`, c.rate == null ? "-" : tk(c.rate)],
          ["COD charge", c.rate == null ? "-" : (c.cod ?? 0).toFixed(2)],
          ["Agreed total", c.expected == null ? "-" : c.expected.toFixed(2)],
          ["Courier billed", o.actual == null ? <span style={{ color: COLORS.muted }}>no bill yet</span> : tk(o.actual)],
          ["Difference", <span key="d" style={{ color: (c.overcharge ?? 0) > overTolerance ? COLORS.loss : undefined }}>{c.overcharge == null ? "-" : `${c.overcharge > 0 ? "+" : ""}${c.overcharge.toFixed(2)}`}</span>, true],
          ...(c.receivable != null ? [["Net receivable from courier", tk(c.receivable)] as [string, string]] : []),
        ]} /></>
    );
  }
  const h = o.hist;
  const timeline: [string, string | undefined][] = [["Booked", o.date], ["Confirmed", h.confirmed], ["Shipped", h.shipped], ["Delivered", h.delivered], ["Returned", h.returned], ["Cancelled", h.cancelled]];
  return (
    <div className="grid gap-[18px] lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)_minmax(0,1fr)]">
      <div>
        <h3 className="mb-1.5 text-[14.5px] font-semibold">Items</h3>
        <table className="w-full overflow-hidden rounded-lg border text-[13.5px]" style={{ borderColor: COLORS.line }}>
          <thead><tr style={{ color: COLORS.muted }}><th className="px-2 py-1 text-left font-medium">Item</th><th className="text-right font-medium">Qty</th><th className="text-right font-medium">Price</th><th className="text-right font-medium">Discount</th><th className="text-right font-medium">Net</th>{money && <th className="px-2 text-right font-medium">Unit cost</th>}</tr></thead>
          <tbody>
            {c.lines.map((l) => (
              <tr key={l.key} className="border-t" style={{ borderColor: COLORS.line }}>
                <td className="px-2 py-1">{l.name}</td><td className="text-right tabular-nums">{l.qty}</td><td className="text-right tabular-nums">{tk(l.price)}</td>
                <td className="text-right tabular-nums">{l.disc ? tk(-l.disc) : "-"}</td><td className="text-right tabular-nums">{tk(l.qty * l.price - l.disc)}</td>
                {money && <td className="px-2 text-right tabular-nums">{l.unitCost == null ? <span style={{ color: COLORS.loss }}>missing</span> : <>{tk(l.unitCost)}{!l.costOk && <span className="ml-1 text-[11.5px]" style={{ color: COLORS.amber }}>unconfirmed</span>}</>}</td>}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="mt-2.5"><Kv rows={[["Payment", `${o.payment}${o.advance ? `, advance ${tk(o.advance)}` : ""}`], ["Courier collects", tk(c.collect)], ["Weight", `${c.weight} kg`]]} /></div>
      </div>
      <div>{moneyBlock ?? <><h3 className="mb-1.5 text-[14.5px] font-semibold">Delivery</h3><p className="text-[13px]" style={{ color: COLORS.muted }}>Courier {courierLabel(o.courier)}, {c.zone}.</p></>}</div>
      <div>
        <h3 className="mb-1.5 text-[14.5px] font-semibold">Timeline</h3>
        <ul className="mt-2.5 list-none p-0 text-sm">
          {timeline.filter(([, d]) => d).map(([k, d]) => (
            <li key={k} className="flex justify-between border-l-2 pb-[5px] pl-2.5 pt-px" style={{ borderColor: COLORS.greenLine }}><span>{k}</span><span>{dmy(d)}</span></li>
          ))}
        </ul>
        {c.flags.length > 0 && <div className="mt-2.5 text-[13.5px]">{c.flags.map((fl) => <div key={fl} className="mb-[3px]"><FlagTag flag={fl} /> {FLAG[fl].action}</div>)}</div>}
        <p className="mt-2.5 text-[13px]" style={{ color: COLORS.muted }}>Confirmed by {agentLabel(o.agentName)}.</p>
      </div>
    </div>
  );
}
