export interface PaymentCardProps {
  accountType: string;
  maskedNumber: string;
  balance: string;
  className?: string;
}

// §5.7 — the one widget allowed a gradient/skeuomorphic flourish. Not
// composed from Card (it's always nested inside a StatCard, matching the
// reference's "Total Balance" layout) and not token-driven for the gradient
// stops, since no neutral/dark-mode equivalent applies to a brand gradient.
export function PaymentCard({ accountType, maskedNumber, balance, className }: PaymentCardProps) {
  return (
    <div
      className={`relative mt-4 overflow-hidden rounded-[14px] bg-gradient-to-r from-brand-400 to-brand-700 px-[18px] pt-[18px] pb-4 text-white ${className ?? ""}`}
    >
      <div className="absolute top-4 right-4 flex">
        <i className="block h-[22px] w-[22px] rounded-full bg-[#EB5B3C]" />
        <i className="-ml-[9px] block h-[22px] w-[22px] rounded-full bg-[#F4A623] mix-blend-screen" />
      </div>
      <div className="text-[11px] opacity-85">Account Type</div>
      <div className="mt-0.5 text-sm font-semibold">{accountType}</div>
      <div className="num mt-[22px] text-[13px] tracking-[2px] opacity-95">{maskedNumber}</div>
      <div className="num mt-1.5 text-xl font-bold">{balance}</div>
    </div>
  );
}
