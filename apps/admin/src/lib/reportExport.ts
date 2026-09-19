import { downloadXlsx } from "@/components/net-profit/sales-report/exportXlsx";
import { parseCsv, toCell } from "./reportTitle";

export { presetTitleRange, reportTitle } from "./reportTitle";

/**
 * Every CSV export endpoint, delivered as a titled .xlsx instead. The server
 * keeps producing CSV (one exporter per report, already tested); this only
 * changes the file the admin hands to the user.
 */
export async function downloadCsvAsXlsx(
  /** A same-origin /api/backend/... export URL, or CSV text already in hand. */
  source: string | { csv: string },
  fileName: string,
  title: string,
): Promise<void> {
  let csv: string;
  if (typeof source === "string") {
    const res = await fetch(source, { credentials: "same-origin" });
    if (!res.ok) throw new Error(`Export failed (${res.status})`);
    csv = await res.text();
  } else {
    csv = source.csv;
  }
  const rows = parseCsv(csv).map((r, i) => (i === 0 ? r : r.map(toCell)));
  await downloadXlsx(fileName, rows, { headerRows: 1 }, title);
}
