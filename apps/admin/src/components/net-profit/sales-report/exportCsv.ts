import { csvText } from "./format";

export function downloadCsv(name: string, rows: (string | number | null | undefined)[][]) {
  const blob = new Blob(["\ufeff" + csvText(rows)], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `amadere-${name}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
