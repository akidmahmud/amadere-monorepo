import type { ReactNode } from "react";
import { cn } from "../lib/cn";
import { Card } from "./Card";

export interface StatCardProps {
  label: string;
  value: string;
  action?: ReactNode;
  children?: ReactNode;
  className?: string;
}

// §5.6 — overline label → display-stat number (the largest text on the
// card) → optional trailing content (e.g. a nested PaymentCard, a gauge).
export function StatCard({ label, value, action, children, className }: StatCardProps) {
  return (
    <Card className={className}>
      <div className="flex items-center justify-between">
        <h3 className="font-ui text-base font-semibold text-text">{label}</h3>
        {action}
      </div>
      <div className="num mt-2 text-[28px] leading-[1.15] font-bold text-text">{value}</div>
      {children}
    </Card>
  );
}
