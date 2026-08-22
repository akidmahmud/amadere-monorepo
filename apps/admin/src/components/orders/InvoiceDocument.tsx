import { QRCodeSVG } from "qrcode.react";
import type { AdminOrder } from "@/hooks/useOrders";
import { useInvoiceSettings, type InvoiceDateFormat } from "@/hooks/useInvoiceSettings";
import { useInvoiceTemplateSettings } from "@/hooks/useInvoiceTemplateSettings";
import { buildInvoiceMergeTags, renderInvoiceTemplate } from "@/lib/invoice-template";

// Brand green, matching the storefront's own palette (packages/ui/src/tokens.css
// --color-green/-dark) — the invoice is a customer-facing document reflecting
// the store's brand, not the admin dashboard's own (blue) accent color.
const GREEN = "#1F703C";
const GREEN_DARK = "#175A2F";
const GREEN_TINT = "#EAF3EC";

const COURIER_DISPLAY_NAME: Record<string, string> = {
  STEADFAST: "SteadFast Courier",
  PATHAO: "Pathao Courier",
  REDX: "RedX",
};

const PAYMENT_PROVIDER_DISPLAY_NAME: Record<string, string> = {
  COD: "Cash on Delivery (COD)",
  BKASH: "bKash",
  NAGAD: "Nagad",
  ROCKET: "Rocket",
  UPAY: "Upay",
  SSLCOMMERZ: "SSLCommerz",
  BANK_TRANSFER: "Bank Transfer",
};

const PAYMENT_STATUS_STYLE: Record<string, string> = {
  PENDING: "bg-[#fdf3d9] text-[#a9740a]",
  AUTHORIZED: "bg-[#e6f4ff] text-[#1a5fa8]",
  CAPTURED: "bg-[#1f703c] text-white",
  FAILED: "bg-[#fbe7e7] text-[#c53030]",
  REFUNDED: "bg-[#eef0f3] text-[#4a5568]",
  PARTIALLY_REFUNDED: "bg-[#eef0f3] text-[#4a5568]",
  CANCELED: "bg-[#eef0f3] text-[#4a5568]",
};

const PAYMENT_STATUS_DISPLAY_NAME: Record<string, string> = {
  PENDING: "PENDING",
  AUTHORIZED: "AUTHORIZED",
  CAPTURED: "PAID",
  FAILED: "FAILED",
  REFUNDED: "REFUNDED",
  PARTIALLY_REFUNDED: "PARTIALLY REFUNDED",
  CANCELED: "CANCELLED",
};

// Gateway wordmark badges — factual "here's which payment method was used"
// labeling (same convention as card-network logos on any e-commerce
// invoice), not a certification/endorsement claim.
const PAYMENT_PROVIDER_BADGE_STYLE: Record<string, string> = {
  BKASH: "bg-[#E2136E] text-white",
  NAGAD: "bg-[#EC1D25] text-white",
  ROCKET: "bg-[#8C3494] text-white",
  UPAY: "bg-[#00A99D] text-white",
  SSLCOMMERZ: "bg-[#1F3B70] text-white",
  BANK_TRANSFER: "bg-[#4a5568] text-white",
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

const boxIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 8 12 3 3 8l9 5 9-5Z" />
    <path d="M3 8v8l9 5 9-5V8M12 13v8" />
  </svg>
);
const cashIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="6" width="20" height="12" rx="2" />
    <circle cx="12" cy="12" r="3" />
    <path d="M6 6v.01M18 18v-.01" />
  </svg>
);
const cardIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="5" width="20" height="14" rx="2" />
    <path d="M2 10h20" />
  </svg>
);
const shieldCheckIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 4.5 6v6c0 4.5 3 7.5 7.5 9 4.5-1.5 7.5-4.5 7.5-9V6L12 3Z" />
    <path d="m9 12 2 2 4-4" />
  </svg>
);
function checkCircleIcon(color: string) {
  return (
    <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </svg>
  );
}
const warningIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="#a9740a" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 3 2 20h20L12 3Z" />
    <path d="M12 10v4M12 17v.01" />
  </svg>
);
const headsetIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 13v-1a8 8 0 0 1 16 0v1" />
    <rect x="2" y="13" width="5" height="7" rx="1.5" />
    <rect x="17" y="13" width="5" height="7" rx="1.5" />
    <path d="M20 20v1a2 2 0 0 1-2 2h-3" />
  </svg>
);
const globeIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9" />
    <path d="M3 12h18M12 3c2.3 2.3 3.6 5.4 3.6 9s-1.3 6.7-3.6 9c-2.3-2.3-3.6-5.4-3.6-9s1.3-6.7 3.6-9Z" />
  </svg>
);
const facebookIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill={GREEN}>
    <path d="M13.5 21v-7h2.4l.4-3h-2.8V9.1c0-.9.3-1.5 1.6-1.5h1.3V4.9c-.3 0-1.1-.1-2-.1-2 0-3.4 1.2-3.4 3.5V11H8.5v3H11v7Z" />
  </svg>
);
const leafIcon = (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke={GREEN} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
    <path d="M4 20c8 0 13-5 13-13V5h-2C7 5 4 10 4 18Z" />
    <path d="M4 20c3-6 6-9 13-13" />
  </svg>
);

// Shared by the single-order print page (print/orders/[id]/invoice) and the
// bulk print page (print/orders/bulk-invoice) — same invoice layout either
// way, just one-per-page vs. stacked-with-page-breaks. Company info, date
// format, invoice prefix, and the confirmed-order gate all come from
// Settings > Invoice Settings (useInvoiceSettings) so every invoice,
// wherever it's printed from, reflects the same site-wide configuration.
// Renders the site-wide custom template from Settings > Invoice Template
// when one is configured and enabled; otherwise falls back to this
// built-in layout (pixel-matched to the confirmed Amader/SteadFast invoice
// reference design — green brand accents, Payment Information box with
// paid/due breakdown, thank-you banner, footer contact bar).
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
  const paymentProvider = latestPayment ? String(latestPayment.provider) : null;
  const paymentStatus = latestPayment ? String(latestPayment.status) : null;
  const isCod = paymentProvider === "COD";

  // Paid = sum of actually-captured payments (net of refunds); due = whatever
  // of the grand total that leaves outstanding. For the common COD case
  // nothing is captured until the courier remits, so paid is 0 and due is
  // the full total — matching the reference invoice's "pay the delivery
  // person the due amount" framing.
  const paidAmount = order.payments.reduce((sum, p) => {
    if ((p.status as unknown as string) !== "CAPTURED") return sum;
    return sum + Number(p.amount) - Number(p.refundedAmount ?? 0);
  }, 0);
  const dueAmount = Math.max(0, Number(order.totalAmount) - paidAmount);

  return (
    <div
      dir={languageSupport === "arabic" ? "rtl" : "ltr"}
      style={{ fontFamily: bodyFontStack, background: "#f5f6fa" }}
      className="p-10 text-sm text-[#666] print:p-0"
    >
      {/* Browsers drop background-color/background-image/box-shadow when
          printing by default (an ink-saving default, not a bug) — without
          this, every colored badge/pill/bar here (and the white text that
          depends on them for contrast) disappears on Print/Save-as-PDF
          regardless of the print dialog's own "Background graphics" toggle. */}
      <style>{`@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; } }`}</style>
      {settings?.customFontEnabled && settings.customFontFamily && (
        <style>{`@import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(settings.customFontFamily)}&display=swap');`}</style>
      )}
      <div className="mx-auto max-w-[900px] rounded-[10px] bg-white p-[50px]">
        <div className="mb-5 flex items-center justify-between">
          {settings?.companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={settings.companyLogoUrl} alt={companyName} className="h-[50px] object-contain" />
          ) : (
            <div className="rounded-md px-4 py-2 text-xl font-bold text-white" style={{ backgroundColor: GREEN }}>
              {companyName}
            </div>
          )}
          <div className="text-[30px] font-bold uppercase text-[#111]">Invoice</div>
        </div>

        <div className="mb-5 flex items-center">
          <div className="mr-5 h-[3px] flex-1 rounded-full" style={{ backgroundColor: GREEN }} />
          <div className="flex gap-5 whitespace-nowrap text-[#111]">
            <p className="m-0">
              Invoice No: <strong style={{ color: GREEN }}>{settings?.invoicePrefix}{order.orderNumber}</strong>
            </p>
            <p className="m-0">
              Date: <strong style={{ color: GREEN }}>{formatInvoiceDate(order.createdAt, dateFormat)}</strong>
            </p>
          </div>
        </div>

        <div className="mb-5 grid grid-cols-2 gap-5">
          <div>
            <p className="mb-1 font-bold" style={{ color: GREEN }}>Invoice To:</p>
            <p className="m-0">{billing?.recipientName}</p>
            <p className="m-0">{billing?.addressLine}</p>
            <p className="m-0">{[billing?.area, billing?.district, billing?.division, billing?.postCode].filter(Boolean).join(", ")}</p>
            <p className="m-0">{billing?.phone}</p>
          </div>
          <div className="text-right">
            <p className="mb-1 font-bold" style={{ color: GREEN }}>Pay To:</p>
            <p className="m-0">{companyName}</p>
            {companyAddress && <p className="m-0">{companyAddress}</p>}
            {settings?.companyEmail && <p className="m-0">{settings.companyEmail}</p>}
            {settings?.companyPhone && <p className="m-0">{settings.companyPhone}</p>}
            {settings?.companyTaxId && <p className="m-0">Tax ID: {settings.companyTaxId}</p>}
          </div>
        </div>

        {shipment && courierName && (
          <div className="mb-5 rounded-md border px-5 py-4" style={{ borderColor: GREEN_TINT, backgroundColor: GREEN_TINT }}>
            <h3 className="m-0 mb-2.5 font-bold" style={{ color: GREEN }}>For {courierName}</h3>
            <hr className="m-0" style={{ borderColor: "rgba(31,112,60,0.25)" }} />
            <div className="mt-2.5 flex items-center justify-between gap-5">
              <div className="flex items-center gap-2">
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white">{boxIcon}</span>
                <h5 className="m-0 font-bold text-[#111]">
                  Parcel ID: <span style={{ color: GREEN }}>#{shipment.trackingCode ?? shipment.consignmentId ?? order.orderNumber}</span>
                </h5>
              </div>
              {shipment.trackingCode && (
                <div className="shrink-0 rounded-md bg-white p-1.5">
                  <QRCodeSVG value={shipment.trackingCode} size={64} />
                </div>
              )}
              {isCod && shipment.codAmount && Number(shipment.codAmount) > 0 && (
                <div className="flex items-center gap-2">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white">{cashIcon}</span>
                  <h5 className="m-0 font-bold text-[#111]">
                    COD Amount: <span style={{ color: GREEN }}>{order.currency} {shipment.codAmount}</span>
                  </h5>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mb-5 overflow-hidden rounded-md border border-[#dbdfea]">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr style={{ backgroundColor: GREEN_TINT }}>
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

        <div className="relative flex items-start justify-between gap-5">
          {(order.status as unknown as string) === "CANCELED" && (
            // Rotated double-ring rubber-stamp look, red-on-white so it reads
            // clearly on screen and reprints correctly (the print-color-adjust
            // override above already forces backgrounds/borders through).
            // Anchored to THIS row (Payment Information / Grand Total),
            // not the whole card — a fixed percentage-of-card offset drifted
            // off target on any order with more/fewer item rows than the
            // reference invoice had; anchoring here keeps it landing on the
            // totals regardless of item count.
            <div
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-1/2 -rotate-[18deg] select-none"
              style={{ top: "78%", left: "68%" }}
            >
              <div
                className="rounded-md border-[4px] px-5 py-1.5"
                style={{ borderColor: "#c53030", boxShadow: "0 0 0 2px #fff, 0 0 0 4px #c53030" }}
              >
                <span
                  className="block text-[22px] font-extrabold tracking-[0.1em] uppercase"
                  style={{ color: "#c53030" }}
                >
                  Cancelled
                </span>
              </div>
            </div>
          )}
          <div className="flex w-[48%] flex-col gap-2.5 rounded-md border border-[#dbdfea] px-5 py-4">
            <div className="flex items-center gap-2">
              {cardIcon}
              <p className="m-0 font-bold" style={{ color: GREEN }}>Payment Information</p>
            </div>
            <div className="flex items-center justify-between text-[#111]">
              <span className="font-semibold">Payment Method</span>
              {paymentProvider && !isCod ? (
                <span className={`rounded-sm px-2 py-0.5 text-xs font-bold ${PAYMENT_PROVIDER_BADGE_STYLE[paymentProvider] ?? "bg-[#4a5568] text-white"}`}>
                  {PAYMENT_PROVIDER_DISPLAY_NAME[paymentProvider] ?? paymentProvider}
                </span>
              ) : (
                <span>{paymentProvider ? PAYMENT_PROVIDER_DISPLAY_NAME[paymentProvider] ?? paymentProvider : "—"}</span>
              )}
            </div>
            <div className="flex items-center justify-between text-[#111]">
              <span className="font-semibold">Payment Status</span>
              {paymentStatus && (
                <span className={`rounded-pill px-2.5 py-0.5 text-xs font-bold uppercase ${PAYMENT_STATUS_STYLE[paymentStatus] ?? "bg-[#eef0f3] text-[#4a5568]"}`}>
                  {PAYMENT_STATUS_DISPLAY_NAME[paymentStatus] ?? paymentStatus}
                </span>
              )}
            </div>
            <div className="flex justify-between text-[#111]">
              <span className="font-semibold">Paid Amount</span>
              <span className={paidAmount > 0 ? "font-bold" : ""} style={paidAmount > 0 ? { color: GREEN } : undefined}>
                {order.currency} {paidAmount.toFixed(0)}
              </span>
            </div>
            <div className="flex justify-between font-bold" style={{ color: dueAmount > 0 ? "#c53030" : GREEN }}>
              <span>Due Amount</span>
              <span>{order.currency} {dueAmount.toFixed(0)}</span>
            </div>
            {isCod && dueAmount > 0 && paymentStatus !== "CANCELED" && (
              <div className="mt-1 flex items-center gap-2 rounded-md bg-[#fdf3d9] px-3 py-2 text-xs text-[#a9740a]">
                {warningIcon}
                Please pay the delivery person the due amount.
              </div>
            )}
            {!isCod && paidAmount > 0 && dueAmount === 0 && (
              <div className="mt-1 flex items-center gap-2 rounded-md bg-[#e6f7ee] px-3 py-2 text-xs" style={{ color: GREEN }}>
                {checkCircleIcon(GREEN)}
                Payment completed successfully. Thank you!
              </div>
            )}
            {settings?.stampEnabled && settings.stampImageUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={settings.stampImageUrl} alt="Stamp" className="mt-2 h-24 w-24 object-contain opacity-90" />
            )}
          </div>
          <div className="flex w-[48%] flex-col gap-1 text-[#111]">
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
            <div className="mt-1 flex justify-between border-t border-dashed border-[#c7ccd6] pt-2.5 text-base font-bold">
              <span className="text-[#111]">Grand Total</span>
              <span style={{ color: GREEN }}>{order.currency} {order.totalAmount}</span>
            </div>
            {paidAmount > 0 && (
              <>
                <div className="mt-1 flex justify-between rounded-sm px-2 py-1.5 font-semibold" style={{ backgroundColor: GREEN_TINT, color: GREEN }}>
                  <span>Paid Amount</span>
                  <span>- {order.currency} {paidAmount.toFixed(0)}</span>
                </div>
                <div className="flex items-center justify-between rounded-sm px-2 py-2 text-base font-bold text-white" style={{ backgroundColor: GREEN_DARK }}>
                  <span className="flex items-center gap-1.5">{checkCircleIcon("#fff")} Total Paid</span>
                  <span>{order.currency} {dueAmount.toFixed(0)}</span>
                </div>
              </>
            )}
          </div>
        </div>

        <div className="mt-5 flex items-center justify-center gap-2 rounded-md py-3 text-sm font-semibold text-white" style={{ backgroundColor: GREEN_DARK }}>
          {shieldCheckIcon}
          Thank you for shopping with <span style={{ color: "#f0c419" }}>{companyName}</span>!
        </div>

        {settings?.termsAndConditions && (
          <div className="mt-5 rounded-md border border-[#dbdfea] px-5 py-4">
            <p className="mb-1 font-bold text-[#111]">Terms &amp; Conditions:</p>
            <p className="m-0 whitespace-pre-wrap">{settings.termsAndConditions}</p>
          </div>
        )}

        {/* Contact strip. Every value comes from Settings > Invoices — the
            website, Facebook and trust lines used to be hardcoded literals
            here beside a settings-driven phone, so updating company details
            refreshed one tile and silently left the rest stale. A blank
            value now hides its tile rather than printing a dash. */}
        {(() => {
          const tiles = [
            { icon: headsetIcon, label: "Need Help?", value: settings?.companyPhone },
            { icon: globeIcon, label: "Visit Our Website", value: settings?.companyWebsite },
            { icon: facebookIcon, label: "Like Our Page", value: settings?.companyFacebook },
            {
              icon: leafIcon,
              label: settings?.trustBadgeTitle,
              value: settings?.trustBadgeSubtitle,
            },
          ].filter((t) => t.label && t.value);

          if (tiles.length === 0) return null;

          return (
            <div
              className="mt-5 grid gap-4 rounded-md bg-[#f5f6fa] px-5 py-4 text-xs text-[#111]"
              style={{ gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))` }}
            >
              {tiles.map((tile, i) => (
                <div key={i} className="flex items-center gap-2">
                  {tile.icon}
                  <div>
                    <p className="m-0 font-semibold">{tile.label}</p>
                    <p className="m-0 text-[#666]">{tile.value}</p>
                  </div>
                </div>
              ))}
            </div>
          );
        })()}
      </div>
    </div>
  );
}
