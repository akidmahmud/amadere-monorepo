"use client";
import type { ReportSettings } from "@/hooks/useSalesReportV2";
import { COLORS, courierLabel } from "./format";

const inp = "w-[88px] rounded-md border bg-white px-1.5 py-0.5 text-right text-sm disabled:bg-[#f6f8f6]";

export function NumInput({ value, step = 1, disabled, label, onChange }: { value: number; step?: number; disabled: boolean; label: string; onChange: (v: number) => void }) {
  return (
    <input type="number" step={step} min={0} aria-label={label} disabled={disabled} className={inp} style={{ borderColor: COLORS.line }}
      defaultValue={value} key={value}
      onBlur={(e) => { const v = parseFloat(e.target.value); if (Number.isNaN(v) || v < 0) e.target.value = String(value); else if (v !== value) onChange(v); }} />
  );
}

export function RateCardEditor({ s, couriers, zones, disabled, onChange }: {
  s: ReportSettings; couriers: string[]; zones: string[]; disabled: boolean; onChange: (next: ReportSettings) => void;
}) {
  const setRate = (courier: string, patch: Partial<ReportSettings["rates"][string]>) =>
    onChange({ ...s, rates: { ...s.rates, [courier]: { ...s.rates[courier], ...patch } } });
  const setZone = (courier: string, zone: string, key: string, v: number) =>
    setRate(courier, { zones: { ...s.rates[courier].zones, [zone]: { ...s.rates[courier].zones[zone], [key]: v } } });
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-[14.5px]">
        <thead><tr className="text-[13.5px]" style={{ color: COLORS.muted }}>
          <th className="px-3 py-2 text-left font-medium">Zone</th><th className="px-3 text-right font-medium">Small parcel up to</th><th className="px-3 text-right font-medium">Small parcel rate ৳</th><th className="px-3 text-right font-medium">First kg ৳</th><th className="px-3 text-right font-medium">Each extra kg ৳</th>
        </tr></thead>
        <tbody>
          {couriers.map((c) => {
            const rc = s.rates[c];
            return [
              <tr key={c} style={{ background: "#fbfcfb" }}>
                <td colSpan={5} className="border-t px-3 py-2 font-semibold" style={{ borderColor: COLORS.line }}>
                  {courierLabel(c)}
                  <span className="ml-3 text-[13px] font-normal" style={{ color: COLORS.muted }}>
                    COD <NumInput value={rc.cod} step={0.01} disabled={disabled} label={`${c} COD %`} onChange={(v) => setRate(c, { cod: v })} /> % on{" "}
                    <select aria-label={`${c} COD base`} disabled={disabled} value={rc.codBase} onChange={(e) => setRate(c, { codBase: e.target.value as "product" | "collect" })} className="rounded-md border px-1 text-sm" style={{ borderColor: COLORS.line }}>
                      <option value="product">product value</option><option value="collect">amount collected</option>
                    </select>
                    <span className="ml-3">Return charge <NumInput value={rc.returnPct} disabled={disabled} label={`${c} return %`} onChange={(v) => setRate(c, { returnPct: v })} /> % of rate</span>
                  </span>
                </td>
              </tr>,
              ...zones.map((z) => (
                <tr key={`${c}-${z}`} className="border-t" style={{ borderColor: COLORS.line }}>
                  <td className="px-3 py-1.5">{z}</td>
                  <td className="px-3 text-right"><NumInput value={rc.zones[z].smallMax} step={0.05} disabled={disabled} label={`${c} ${z} small max`} onChange={(v) => setZone(c, z, "smallMax", v)} /> kg</td>
                  <td className="px-3 text-right"><NumInput value={rc.zones[z].small} disabled={disabled} label={`${c} ${z} small`} onChange={(v) => setZone(c, z, "small", v)} /></td>
                  <td className="px-3 text-right"><NumInput value={rc.zones[z].first} disabled={disabled} label={`${c} ${z} first`} onChange={(v) => setZone(c, z, "first", v)} /></td>
                  <td className="px-3 text-right"><NumInput value={rc.zones[z].extra} disabled={disabled} label={`${c} ${z} extra`} onChange={(v) => setZone(c, z, "extra", v)} /></td>
                </tr>
              )),
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}
