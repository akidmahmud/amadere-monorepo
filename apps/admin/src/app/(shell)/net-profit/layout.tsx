// Wraps every /net-profit/* page in the violet WPFOK-parity design scope
// (see packages/admin-ui/src/globals.css's `.wpfok-scope`) — approved
// exception to DESIGN_SYSTEM.md's "one brand color" rule, scoped to this
// route tree only. The rest of the admin app is unaffected.
export default function NetProfitLayout({ children }: { children: React.ReactNode }) {
  return <div className="wpfok-scope">{children}</div>;
}
