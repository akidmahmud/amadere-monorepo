import { proxyFetch } from "@/lib/api/proxy-client";
import { downloadXlsx } from "@/components/net-profit/sales-report/exportXlsx";

/**
 * Every row matching the current filters (not just the page on screen),
 * fetched 100 at a time, as a titled .xlsx.
 * ponytail: sequential pages; add a server-side export if lists reach 10k+.
 */
export async function exportAllPagesXlsx<T>(
  path: string,
  params: Record<string, string | number | null | undefined>,
  headers: string[],
  toRow: (item: T) => (string | number | null)[],
  fileName: string,
  title: string,
): Promise<number> {
  const items: T[] = [];
  for (let page = 1; ; page++) {
    const qs = new URLSearchParams();
    const all: Record<string, unknown> = { ...params, page, pageSize: 100 };
    for (const [k, v] of Object.entries(all))
      if (v !== null && v !== undefined && v !== "") qs.set(k, String(v));
    const r = await proxyFetch<{ items: T[]; total: number }>(`${path}?${qs}`);
    items.push(...r.items);
    if (items.length >= r.total || r.items.length === 0) break;
  }
  await downloadXlsx(
    fileName,
    [headers, ...items.map(toRow)],
    { headerRows: 1 },
    title,
  );
  return items.length;
}
