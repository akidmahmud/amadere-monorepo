import { redirect } from "next/navigation";

// Profit Manager and Sales Report merged into one tabbed page (WPFOK
// parity — the plugin itself is one "Sales Report" screen with Dashboard/
// Products/Settings tabs, not two separate menu items).
export default function ProfitRedirectPage() {
  redirect("/net-profit/reports");
}
