import type { WholesaleOrder } from "@/hooks/useWholesale";
import { COURIERS } from "@/hooks/useWholesale";
import type {
  InvoiceSettings,
  InvoiceDateFormat,
} from "@/hooks/useInvoiceSettings";

// Wholesale invoices render through the SAME Settings > Invoice Template a
// retail order does. That is the whole point of this file: it emits the same
// {{tag}} vocabulary buildInvoiceMergeTags does, so a store owner writes and
// maintains one template and it works for both books.
//
// Tags with no wholesale meaning are emitted empty rather than omitted —
// renderInvoiceTemplate substitutes an unknown tag with "", so a retail
// template containing {{codFeeRow}} simply drops that row instead of printing
// a literal "{{codFeeRow}}" on a customer's invoice.

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ] as string,
  );
}

function formatInvoiceDate(
  value: string | Date,
  format: InvoiceDateFormat,
): string {
  const date = new Date(value);
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  if (format === "DMY") return `${d}/${m}/${y}`;
  if (format === "YMD") return `${y}-${m}-${d}`;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function totalsRow(label: string, amount: string, currency: string): string {
  return `<tr><td style="padding:4px 0;color:#111;">${escapeHtml(label)}</td><td style="padding:4px 0;text-align:right;color:#111;">${escapeHtml(currency)} ${escapeHtml(amount)}</td></tr>`;
}

const courierLabel = (value: string) =>
  COURIERS.find((c) => c.value === value)?.label ?? value;

export function buildWholesaleInvoiceMergeTags(
  order: WholesaleOrder,
  settings: InvoiceSettings | undefined,
): Record<string, string> {
  const dateFormat = settings?.dateFormat ?? "MDY";
  // Wholesale is domestic bulk trade; there is no per-order currency column on
  // the order the way retail carries one, so it is the store's own.
  const currency = "৳";

  const itemsTableRows = order.items
    .map(
      (item) =>
        `<tr style="border-bottom:1px solid #dbdfea;"><td style="padding:10px 15px;">${escapeHtml(item.name)}${item.sku ? ` <span style="color:#b5b5b5;">(${escapeHtml(item.sku)})</span>` : ""}</td><td style="padding:10px 15px;">${currency} ${escapeHtml(item.unitPrice)}</td><td style="padding:10px 15px;">${item.quantity}</td><td style="padding:10px 15px;text-align:right;">${currency} ${escapeHtml(item.lineTotal)}</td></tr>`,
    )
    .join("");

  const companyName = settings?.companyName || "Amader";
  const companyAddress = [
    settings?.companyAddress,
    settings?.companyCity,
    settings?.companyState,
    settings?.companyCountry,
  ]
    .filter(Boolean)
    .join(", ");

  // The courier box is the wholesale equivalent of retail's shipment panel:
  // the consignment number here is typed in off the counterfoil, so it only
  // renders once someone has actually entered one.
  const courierBoxHtml = order.consignmentId
    ? `<div style="margin-bottom:20px;padding:15px 20px;border:1px solid #dbdfea;border-radius:6px;">
      <h3 style="margin:0 0 10px;color:#111;">For ${escapeHtml(courierLabel(order.courier))}</h3>
      <hr style="margin:0;border:none;border-top:1px solid #dbdfea;">
      <div style="margin-top:10px;display:flex;justify-content:space-between;gap:20px;">
        <h5 style="margin:0;color:#111;">Consignment ID: #${escapeHtml(order.consignmentId)}</h5>
        ${Number(order.due) > 0 ? `<h5 style="margin:0;color:#111;">Due on delivery: ${currency} ${escapeHtml(order.due)}</h5>` : ""}
      </div>
    </div>`
    : "";

  return {
    companyLogoHtml: settings?.companyLogoUrl
      ? `<img src="${escapeHtml(settings.companyLogoUrl)}" alt="${escapeHtml(companyName)}" style="max-height:50px;object-fit:contain;">`
      : `<div style="font-size:20px;font-weight:700;color:#111;">${escapeHtml(companyName)}</div>`,
    companyName,
    companyAddress,
    companyEmail: settings?.companyEmail ?? "",
    companyPhone: settings?.companyPhone ?? "",
    companyTaxId: settings?.companyTaxId ?? "",
    // The accounts doc number when the order has raised one, so a printed
    // wholesale invoice can be matched to its receivable in Accounts. Falls
    // back to the order number for a cancelled order, whose due is voided.
    invoiceNumber: `${settings?.invoicePrefix ?? ""}${order.invoiceDocNo ?? order.orderNumber}`,
    invoiceDate: formatInvoiceDate(order.placedAt, dateFormat),
    customerName: order.customerName,
    customerPhone: order.customerPhone ?? "",
    customerAddress: "",
    courierBoxHtml,
    itemsTableRows,
    currency,
    subTotal: order.subtotal,
    discountRow:
      Number(order.discount) > 0
        ? totalsRow("Discount", `-${order.discount}`, currency)
        : "",
    shippingRow:
      Number(order.deliveryCharge) > 0
        ? totalsRow("Delivery charge", order.deliveryCharge, currency)
        : "",
    // No VAT or COD fee on a wholesale order — emitted empty so a shared
    // retail template drops the rows rather than printing the raw tag.
    taxRow: "",
    codFeeRow: "",
    totalAmount: order.total,
    // Retail's single payment provider has no wholesale equivalent: a
    // wholesale invoice is settled over time against its receivable, so what
    // is useful here is how much of it has been collected.
    paymentMethod: `Paid ${currency} ${order.paid}`,
    paymentStatus:
      Number(order.due) > 0 ? `Due ${currency} ${order.due}` : "Settled",
    stampImageHtml:
      settings?.stampEnabled && settings.stampImageUrl
        ? `<div style="margin-top:20px;"><img src="${escapeHtml(settings.stampImageUrl)}" alt="Stamp" style="height:96px;width:96px;object-fit:contain;opacity:0.9;"></div>`
        : "",
    termsBlock: settings?.termsAndConditions
      ? `<div style="margin-top:20px;padding:15px 20px;border:1px solid #dbdfea;border-radius:6px;"><p style="margin:0 0 5px;color:#111;"><strong>Terms &amp; Conditions:</strong></p><p style="margin:0;white-space:pre-wrap;">${escapeHtml(settings.termsAndConditions)}</p></div>`
      : "",
  };
}
