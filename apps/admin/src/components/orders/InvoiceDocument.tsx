import { QRCodeSVG } from "qrcode.react";
import type { AdminOrder } from "@/hooks/useOrders";
import { useInvoiceSettings, type InvoiceDateFormat } from "@/hooks/useInvoiceSettings";
import { useInvoiceTemplateSettings } from "@/hooks/useInvoiceTemplateSettings";
import { buildInvoiceMergeTags, renderInvoiceTemplate } from "@/lib/invoice-template";

const COURIER_DISPLAY_NAME: Record<string, string> = {
  STEADFAST: "SteadFast Courier",
  PATHAO: "Pathao Courier",
  REDX: "RedX",
};

function formatInvoiceDate(value: string | Date, format: InvoiceDateFormat): string {
  const date = new Date(value);
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = date.getFullYear();
  if (format === "DMY") return `${d}/${m}/${y}`;
  if (format === "YMD") return `${y}-${m}-${d}`;
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const LANGUAGE_FONT_STACK: Record<string, string> = {
  arabic: "'Noto Naskh Arabic', Arial, sans-serif",
  bengali: "'Noto Sans Bengali', Arial, sans-serif",
  chinese: "'Noto Sans SC', Arial, sans-serif",
  default: "Inter, Arial, sans-serif",
};

// Shared by the single-order print page (print/orders/[id]/invoice) and the
// bulk print page (print/orders/bulk-invoice) — same invoice layout either
// way, just one-per-page vs. stacked-with-page-breaks. Company info, date
// format, invoice prefix, and the confirmed-order gate all come from
// Settings > Invoice Settings (useInvoiceSettings) so every invoice,
// wherever it's printed from, reflects the same site-wide configuration.
// Renders the site-wide custom template from Settings > Invoice Template
// when one is configured and enabled; otherwise falls back to this
// built-in layout (styled after the real Amader/SteadFast invoice
// reference: rounded card, Invoice To / Pay To columns, bordered item
// table, totals footer, terms box).
export function InvoiceDocument({ order }: { order: AdminOrder }) {
  const { data: settings } = useInvoiceSettings();
  const { data: templateSettings } = useInvoiceTemplateSettings();
  const shipping = order.addresses.find((a) => (a.type as unknown as string) === "SHIPPING");
  const billing = order.addresses.find((a) => (a.type as unknown as string) === "BILLING") ?? shipping;
  const latestPayment = order.payments[order.payments.length - 1];

  if (settings?.disableUntilConfirmed && (order.status as unknown as string) === "PENDING") {
    return (
      <div className="mx-auto max-w-3xl p-10 text-center text-sm text-black print:p-0">
        <p className="text-base font-semibold">Invoice not available</p>
        <p className="text-muted">Order {order.orderNumber} hasn&apos;t been confirmed yet.</p>
      </div>
    );
  }

  if (templateSettings?.enabled && templateSettings.template) {
    const tags = buildInvoiceMergeTags(order, settings);
    const html = renderInvoiceTemplate(templateSettings.template, tags);
    // eslint-disable-next-line react/no-danger
    return <div className="print:m-0" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  const companyName = settings?.companyName || "Amader";
  const dateFormat = settings?.dateFormat ?? "MDY";
  const companyAddress = [settings?.companyAddress, settings?.companyCity, settings?.companyState, settings?.companyCountry]
    .filter(Boolean)
    .join(", ");
  const languageSupport = settings?.languageSupport ?? "default";
  const fontFamily =
    settings?.customFontEnabled && settings.customFontFamily ? `'${settings.customFontFamily}', ` : "";
  const bodyFontStack = fontFamily + LANGUAGE_FONT_STACK[languageSupport];

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

  return (
    <div
      dir={languageSupport === "arabic" ? "rtl" : "ltr"}
      style={{ fontFamily: bodyFontStack, background: "#f5f6fa" }}
      className="p-10 text-sm text-[#666] print:p-0"
    >
      {settings?.customFontEnabled && settings.customFontFamily && (
        <style>{`@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(settings.customFontFamily)}&display=swap');`}</style>
      )}
      <div className="mx-auto max-w-[900px] rounded-[10px] bg-white p-[50px]">
        <div className="mb-5 flex items-center justify-between">
          {settings?.companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.companyLogoUrl} alt={companyName} className="h-[50px] object-contain" />
          ) : (
            <div className="text-xl font-bold text-[#111]">{companyName}</div>
          )}
          <div className="text-[30px] font-bold uppercase text-[#111]">Invoice</div>
        </div>

        <div className="mb-5 flex items-center">
          <div className="mr-5 h-0.5 flex-1 rounded-full bg-[#111]" />
          <div className="flex gap-5 whitespace-nowrap text-[#111]">
            <p className="m-0">Invoice No: <strong>{settings?.invoicePrefix}{order.orderNumber}</strong></p>
            <p className="m-0">Date: <strong>{formatInvoiceDate(order.createdAt, dateFormat)}</strong></p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-5">
          <div>
            <p className="mb-1 font-bold text-[#111]">Invoice To:</p>
            <p className="m-0">{billing?.recipientName}</p>
            <p className="m-0">{billing?.addressLine}</p>
            <p className="m-0">{[billing?.area, billing?.district, billing?.division, billing?.postCode].filter(Boolean).join(", ")}</p>
            <p className="m-0">{billing?.phone}</p>
          </div>
          <div className="text-right">
            <p className="mb-1 font-bold text-[#111]">Pay To:</p>
            <p className="m-0">{companyName}</p>
            {companyAddress && <p className="m-0">{companyAddress}</p>}
            {settings?.companyEmail && <p className="m-0">{settings.companyEmail}</p>}
            {settings?.companyPhone && <p className="m-0">{settings.companyPhone}</p>}
            {settings?.companyTaxId && <p className="m-0">Tax ID: {settings.companyTaxId}</p>}
          </div>
        </div>

        {shipment && courierName && (
          <div className="mb-5 rounded-md border border-[#dbdfea] px-5 py-4">
            <h3 className="m-0 mb-2.5 font-bold text-[#111]">For {courierName}</h3>
            <hr className="m-0 border-[#dbdfea]" />
            <div className="mt-2.5 flex items-center justify-between gap-5">
              <h5 className="m-0 font-bold text-[#111]">Parcel ID: #{shipment.trackingCode ?? shipment.consignmentId ?? order.orderNumber}</h5>
              {shipment.trackingCode && (
                <QRCodeSVG value={shipment.trackingCode} size={70} />
              )}
              {isCod && shipment.codAmount && Number(shipment.codAmount) > 0 && (
                <h5 className="m-0 font-bold text-[#111]">COD Amount: {order.currency} {shipment.codAmount}</h5>
              )}
            </div>
          </div>
        )}

        <div className="mb-5 overflow-hidden rounded-md border border-[#dbdfea]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-[#f5f6fa]">
                <th className="px-4 py-2.5 text-[#111]">Item</th>
                <th className="px-4 py-2.5 text-[#111]">Price</th>
                <th className="px-4 py-2.5 text-[#111]">Qty</th>
                <th className="px-4 py-2.5 text-right text-[#111]">Total</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map((item) => (
                <tr key={item.id} className="border-b border-[#dbdfea]">
                  <td className="px-4 py-2.5">{item.name} {item.sku && <span className="text-[#b5b5b5]">({item.sku})</span>} {item.weight && <span className="text-[#b5b5b5]">— {item.weight} kg</span>}</td>
                  <td className="px-4 py-2.5">{order.currency} {item.unitPrice}</td>
                  <td className="px-4 py-2.5">{item.quantity}</td>
                  <td className="px-4 py-2.5 text-right">{order.currency} {(Number(item.unitPrice) * item.quantity).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex items-start justify-between gap-5">
          <div className="w-[55%]">
            <p className="mb-1 font-bold text-[#111]">Payment info:</p>
            <p className="m-0">{latestPayment ? String(latestPayment.provider) : "—"}</p>
            <p className="m-0 text-xs text-[#b5b5b5]">{latestPayment ? String(latestPayment.status) : ""}</p>
            {settings?.stampEnabled && settings.stampImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.stampImageUrl} alt="Stamp" className="mt-5 h-24 w-24 object-contain opacity-90" />
            )}
          </div>
          <div className="flex w-[45%] flex-col gap-1 text-[#111]">
            <div className="flex justify-between"><span>Subtotal</span><span>{order.currency} {order.subTotal}</span></div>
            {displayDiscount > 0 && (
              <div className="flex justify-between">
                <span>Discount{order.couponCode ? ` (${order.couponCode})` : ""}</span>
                <span>-{order.currency} {displayDiscount.toFixed(2)}</span>
              </div>
            )}
            {Number(order.shippingAmount) > 0 && <div className="flex justify-between"><span>Shipping cost</span><span>{order.currency} {order.shippingAmount}</span></div>}
            {Number(order.taxAmount) > 0 && (
              <div className="flex justify-between">
                <span>Tax{taxRatePercent !== null ? ` (${taxRatePercent}%)` : ""}</span>
                <span>{order.currency} {order.taxAmount}</span>
              </div>
            )}
            {Number(order.codFee) > 0 && <div className="flex justify-between"><span>COD Fee</span><span>{order.currency} {order.codFee}</span></div>}
            <div className="flex justify-between border-y-2 border-[#111] py-1.5 text-base font-bold">
              <span>Grand Total</span><span>{order.currency} {order.totalAmount}</span>
            </div>
          </div>
        </div>

        {settings?.termsAndConditions && (
          <div className="mt-5 rounded-md border border-[#dbdfea] px-5 py-4">
            <p className="mb-1 font-bold text-[#111]">Terms &amp; Conditions:</p>
            <p className="m-0 whitespace-pre-wrap">{settings.termsAndConditions}</p>
          </div>
        )}
      </div>
    </div>
  );
}
