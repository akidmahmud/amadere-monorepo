import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export interface TableProps {
  children: ReactNode;
  className?: string;
}

// Net Profit / WPFOK-parity data table — plain semantic <thead>/<tbody>/
// <tr>/<td> markup inside picks up the striped/hover/uppercase-header
// styling automatically (see globals.css's `.wpfok-scope .wpfok-table`
// rules); no Thead/Tr/Td wrapper components needed. Not used outside
// /net-profit pages — the CSS is scoped to `.wpfok-scope`.
export function Table({ children, className }: TableProps) {
  return (
    <div className="wpfok-table-scroll">
      <table className={cn("wpfok-table", className)}>{children}</table>
    </div>
  );
}

export function TableIdBadge({ children }: { children: ReactNode }) {
  return <span className="wpfok-id-badge">{children}</span>;
}

export function TableEmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <tr className="wpfok-no-data">
      <td colSpan={colSpan}>{children}</td>
    </tr>
  );
}
