import NetProfitOverviewPage from "./net-profit/page";

// Root "Overview" nav slot now shows the same page as /net-profit — wrapped
// in the same violet WPFOK scope net-profit/layout.tsx applies to its own
// subtree, since this page lives outside that directory and wouldn't
// otherwise inherit it (see net-profit/layout.tsx).
export default function OverviewPage() {
  return (
    <div className="wpfok-scope">
      <NetProfitOverviewPage />
    </div>
  );
}
