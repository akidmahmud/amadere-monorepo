// Wraps every /customers/* page in the same violet WPFOK-parity design
// scope Net Profit uses (see packages/admin-ui/src/globals.css's
// `.wpfok-scope`) — matches net-profit/layout.tsx exactly.
export default function CustomersLayout({ children }: { children: React.ReactNode }) {
  return <div className="wpfok-scope">{children}</div>;
}
