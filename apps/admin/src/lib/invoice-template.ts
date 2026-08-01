import type { AdminOrder } from "@/hooks/useOrders";
import type { InvoiceSettings, InvoiceDateFormat } from "@/hooks/useInvoiceSettings";

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}

function formatInvoiceDate(value: string | Date, format: InvoiceDateFormat): string {
  const date = new Date(value);
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  if (format === "DMY") return `${d}/${m}/${y}`;
  if (format === "YMD") return `${y}-${m}-${d}`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function totalsRow(label: string, amount: string, currency: string): string {
  return `<tr><td style="padding:4px 0;color:#111;">${escapeHtml(label)}</td><td style="padding:4px 0;text-align:right;color:#111;">${escapeHtml(currency)} ${escapeHtml(amount)}</td></tr>`;
}

const COURIER_DISPLAY_NAME: Record<string, string> = {
  STEADFAST: "SteadFast Courier",
  PATHAO: "Pathao Courier",
  REDX: "RedX",
};

// Same {{tag}} substitution convention as shipping-label-template.ts —
// plain string replace, no template engine. Line items and conditional
// totals rows can't be single merge tags (variable count), so they're
// pre-rendered HTML fragments here; the default template just drops them
// into {{itemsTableRows}} / {{discountRow}} / etc.
export function buildInvoiceMergeTags(order: AdminOrder, settings: InvoiceSettings | undefined): Record<string, string> {
  const shipping = order.addresses.find((a) => (a.type as unknown as string) === "SHIPPING");
  const billing = order.addresses.find((a) => (a.type as unknown as string) === "BILLING") ?? shipping;
  const latestPayment = order.payments[order.payments.length - 1];
  const dateFormat = settings?.dateFormat ?? "MDY";
  const currency = order.currency;

  const itemsTableRows = order.items
    .map((item) => {
      const total = (Number(item.unitPrice) * item.quantity).toFixed(2);
      return `<tr style="border-bottom:1px solid #dbdfea;"><td style="padding:10px 15px;">${escapeHtml(item.name)}${item.sku ? ` <span style="color:#b5b5b5;">(${escapeHtml(item.sku)})</span>` : ""}</td><td style="padding:10px 15px;">${escapeHtml(currency)} ${escapeHtml(String(item.unitPrice))}</td><td style="padding:10px 15px;">${item.quantity}</td><td style="padding:10px 15px;text-align:right;">${escapeHtml(currency)} ${total}</td></tr>`;
    })
    .join("");

  // order.totalAmount is correctly floored at 0 server-side when a discount
  // exceeds everything else (e.g. an over-generous manual discount) — but
  // showing the raw discount next to that floored total makes the printed
  // rows fail to add up. Cap the displayed discount at what's actually being
  // deducted so the breakdown always reconciles with the Grand Total shown.
  const grossBeforeDiscount = Number(order.subTotal) + Number(order.taxAmount) + Number(order.codFee) + Number(order.shippingAmount);
  const displayDiscount = Math.min(Number(order.discountAmount), grossBeforeDiscount);
  const taxBase = Number(order.subTotal) - displayDiscount;
  const taxRatePercent = Number(order.taxAmount) > 0 && taxBase > 0 ? Math.round((Number(order.taxAmount) / taxBase) * 100) : null;

  const shipment = order.shipment;
  const courierName = shipment ? COURIER_DISPLAY_NAME[shipment.provider as unknown as string] ?? String(shipment.provider) : null;
  const isCod = (latestPayment?.provider as unknown as string) === "COD";
  // No QR code here (unlike InvoiceDocument.tsx's built-in layout, which uses
  // qrcode.react) — generating a scannable code from a raw HTML string would
  // need an async image data-URL, which this synchronous merge-tag builder
  // isn't set up for. Parcel ID/COD amount text is still real and useful.
  const courierBoxHtml =
    shipment && courierName
      ? `<div style="margin-bottom:20px;padding:15px 20px;border:1px solid #dbdfea;border-radius:6px;">
      <h3 style="margin:0 0 10px;color:#111;">For ${escapeHtml(courierName)}</h3>
      <hr style="margin:0;border:none;border-top:1px solid #dbdfea;">
      <div style="margin-top:10px;display:flex;justify-content:space-between;gap:20px;">
        <h5 style="margin:0;color:#111;">Parcel ID: #${escapeHtml(shipment.trackingCode ?? shipment.consignmentId ?? order.orderNumber)}</h5>
        ${isCod && shipment.codAmount && Number(shipment.codAmount) > 0 ? `<h5 style="margin:0;color:#111;">COD Amount: ${escapeHtml(currency)} ${escapeHtml(shipment.codAmount)}</h5>` : ""}
      </div>
    </div>`
      : "";

  const companyName = settings?.companyName || "Amader";
  const companyAddress = [settings?.companyAddress, settings?.companyCity, settings?.companyState, settings?.companyCountry]
    .filter(Boolean)
    .join(", ");
  const customerAddress = [billing?.addressLine, billing?.area, billing?.district, billing?.division, billing?.postCode]
    .filter(Boolean)
    .join(", ");

  return {
    companyLogoHtml: settings?.companyLogoUrl
      ? `<img src="${escapeHtml(settings.companyLogoUrl)}" alt="${escapeHtml(companyName)}" style="max-height:50px;object-fit:contain;">`
      : `<div style="font-size:20px;font-weight:700;color:#111;">${escapeHtml(companyName)}</div>`,
    companyName,
    companyAddress,
    companyEmail: settings?.companyEmail ?? "",
    companyPhone: settings?.companyPhone ?? "",
    companyTaxId: settings?.companyTaxId ?? "",
    invoiceNumber: `${settings?.invoicePrefix ?? ""}${order.orderNumber}`,
    invoiceDate: formatInvoiceDate(order.createdAt, dateFormat),
    customerName: billing?.recipientName ?? "",
    customerPhone: billing?.phone ?? "",
    customerAddress,
    courierBoxHtml,
    itemsTableRows,
    currency,
    subTotal: String(order.subTotal),
    discountRow: displayDiscount > 0 ? totalsRow(`Discount${order.couponCode ? ` (${order.couponCode})` : ""}`, `-${displayDiscount.toFixed(2)}`, currency) : "",
    taxRow: Number(order.taxAmount) > 0 ? totalsRow(`Tax${taxRatePercent !== null ? ` (${taxRatePercent}%)` : ""}`, order.taxAmount, currency) : "",
    codFeeRow: Number(order.codFee) > 0 ? totalsRow("COD Fee", order.codFee, currency) : "",
    shippingRow: Number(order.shippingAmount) > 0 ? totalsRow("Shipping cost", order.shippingAmount, currency) : "",
    totalAmount: String(order.totalAmount),
    paymentMethod: latestPayment ? String(latestPayment.provider) : "—",
    paymentStatus: latestPayment ? String(latestPayment.status) : "—",
    stampImageHtml:
      settings?.stampEnabled && settings.stampImageUrl
        ? `<div style="margin-top:20px;"><img src="${escapeHtml(settings.stampImageUrl)}" alt="Stamp" style="height:96px;width:96px;object-fit:contain;opacity:0.9;"></div>`
        : "",
    termsBlock: settings?.termsAndConditions
      ? `<div style="margin-top:20px;padding:15px 20px;border:1px solid #dbdfea;border-radius:6px;"><p style="margin:0 0 5px;color:#111;"><strong>Terms &amp; Conditions:</strong></p><p style="margin:0;white-space:pre-wrap;">${escapeHtml(settings.termsAndConditions)}</p></div>`
      : "",
  };
}

export function renderInvoiceTemplate(template: string, tags: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => tags[key] ?? "");
}
