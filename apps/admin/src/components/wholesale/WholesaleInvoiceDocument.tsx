"use client";

import { useInvoiceSettings } from "@/hooks/useInvoiceSettings";
import { useInvoiceTemplateSettings } from "@/hooks/useInvoiceTemplateSettings";
import { renderInvoiceTemplate } from "@/lib/invoice-template";
import { buildWholesaleInvoiceMergeTags } from "@/lib/wholesale-invoice-template";
import { COURIERS, type WholesaleOrder } from "@/hooks/useWholesale";

const money = (v: string | number) =>
  `৳${Number(v).toLocaleString("en-BD", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const courierLabel = (v: string) =>
  COURIERS.find((c) => c.value === v)?.label ?? v;

/**
 * A wholesale invoice, rendered through Settings > Invoice Template when one
 * is enabled — the same template retail invoices use, fed by the same merge
 * tags (see lib/wholesale-invoice-template.ts). One template to maintain.
 *
 * The built-in layout below is the fallback for stores that have not written
 * a custom template. It is deliberately plainer than retail's: a wholesale
 * invoice is a trade document between two businesses, so it leads with the
 * receivable position (billed / collected / outstanding) rather than the
 * consumer-facing thank-you styling.
 */
export function WholesaleInvoiceDocument({ order }: { order: WholesaleOrder }) {
  const { data: settings } = useInvoiceSettings();
  const { data: templateSettings } = useInvoiceTemplateSettings();

  if (templateSettings?.enabled && templateSettings.template) {
    const tags = buildWholesaleInvoiceMergeTags(order, settings);
    const html = renderInvoiceTemplate(templateSettings.template, tags);

    return (
      <div className="print:m-0" dangerouslySetInnerHTML={{ __html: html }} />
    );
  }

  const companyName = settings?.companyName || "Amader";
  const companyAddress = [
    settings?.companyAddress,
    settings?.companyCity,
    settings?.companyState,
    settings?.companyCountry,
  ]
    .filter(Boolean)
    .join(", ");
  const outstanding = Number(order.due);

  return (
    <div className="mx-auto max-w-3xl bg-white p-10 text-black print:p-0">
      <div className="flex items-start justify-between gap-6 border-b border-neutral-300 pb-6">
        <div>
          {settings?.companyLogoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={settings.companyLogoUrl}
              alt={companyName}
              className="max-h-12 object-contain"
            />
          ) : (
            <div className="text-xl font-bold">{companyName}</div>
          )}
          {companyAddress && (
            <p className="mt-1 text-xs text-neutral-600">{companyAddress}</p>
          )}
          {settings?.companyPhone && (
            <p className="text-xs text-neutral-600">{settings.companyPhone}</p>
          )}
          {settings?.companyTaxId && (
            <p className="text-xs text-neutral-600">
              BIN/TIN: {settings.companyTaxId}
            </p>
          )}
        </div>
        <div className="text-right">
          <h1 className="text-lg font-bold uppercase tracking-wide">
            Wholesale Invoice
          </h1>
          <p className="text-sm font-semibold">
            {settings?.invoicePrefix ?? ""}
            {order.invoiceDocNo ?? order.orderNumber}
          </p>
          <p className="text-xs text-neutral-600">Order {order.orderNumber}</p>
          <p className="text-xs text-neutral-600">
            {new Date(order.placedAt).toLocaleDateString("en-GB")}
          </p>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-2 gap-6 text-sm">
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500">
            Billed to
          </p>
          <p className="font-semibold">{order.customerName}</p>
          {order.customerPhone && (
            <p className="text-neutral-700">{order.customerPhone}</p>
          )}
        </div>
        <div>
          <p className="text-xs font-semibold uppercase text-neutral-500">
            Delivery
          </p>
          <p className="text-neutral-700">{courierLabel(order.courier)}</p>
          {order.consignmentId && (
            <p className="text-neutral-700">
              Consignment: {order.consignmentId}
            </p>
          )}
        </div>
      </div>

      <table className="mt-6 w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-neutral-300 text-left text-xs uppercase text-neutral-500">
            <th className="py-2">Product</th>
            <th className="py-2">Rate</th>
            <th className="py-2">Qty</th>
            <th className="py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody>
          {order.items.map((item) => (
            <tr key={item.id} className="border-b border-neutral-200">
              <td className="py-2">
                {item.name}
                {item.sku && (
                  <span className="ml-1 text-xs text-neutral-500">
                    ({item.sku})
                  </span>
                )}
              </td>
              <td className="py-2">{money(item.unitPrice)}</td>
              <td className="py-2">{item.quantity}</td>
              <td className="py-2 text-right">{money(item.lineTotal)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="mt-4 flex justify-end">
        <table className="w-64 text-sm">
          <tbody>
            <tr>
              <td className="py-1">Subtotal</td>
              <td className="py-1 text-right">{money(order.subtotal)}</td>
            </tr>
            {Number(order.deliveryCharge) > 0 && (
              <tr>
                <td className="py-1">Delivery charge</td>
                <td className="py-1 text-right">
                  {money(order.deliveryCharge)}
                </td>
              </tr>
            )}
            {Number(order.discount) > 0 && (
              <tr>
                <td className="py-1">Discount</td>
                <td className="py-1 text-right">−{money(order.discount)}</td>
              </tr>
            )}
            <tr className="border-t border-neutral-300 font-bold">
              <td className="py-2">Total</td>
              <td className="py-2 text-right">{money(order.total)}</td>
            </tr>
            <tr>
              <td className="py-1">Collected</td>
              <td className="py-1 text-right">{money(order.paid)}</td>
            </tr>
            <tr
              className={
                outstanding > 0 ? "font-bold text-red-700" : "font-semibold"
              }
            >
              <td className="py-1">
                {outstanding > 0 ? "Outstanding" : "Settled"}
              </td>
              <td className="py-1 text-right">{money(order.due)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {order.note && (
        <p className="mt-6 border-t border-neutral-200 pt-4 text-xs text-neutral-700">
          <strong>Note:</strong> {order.note}
        </p>
      )}

      {settings?.termsAndConditions && (
        <div className="mt-4 rounded border border-neutral-300 p-4 text-xs">
          <p className="font-semibold">Terms &amp; Conditions</p>
          <p className="whitespace-pre-wrap text-neutral-700">
            {settings.termsAndConditions}
          </p>
        </div>
      )}

      {settings?.stampEnabled && settings.stampImageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={settings.stampImageUrl}
          alt="Stamp"
          className="mt-6 h-24 w-24 object-contain opacity-90"
        />
      )}
    </div>
  );
}
