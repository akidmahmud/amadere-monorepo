import type { AdminOrder } from "@/hooks/useOrders";
import { useShippingLabelSettings } from "@/hooks/useShippingLabelSettings";
import { useInvoiceSettings } from "@/hooks/useInvoiceSettings";
import { buildLabelMergeTags, renderLabelTemplate } from "@/lib/shipping-label-template";

// Basic DIY label — no courier (Steadfast/Pathao/RedX) exposes a real
// label-print API in this codebase today, so this prints from our own
// order/shipment data rather than the courier's official artwork. Shared
// by the single-order and bulk label print pages. Renders the site-wide
// custom template from Settings > Shipping Label when one is configured
// and enabled; otherwise falls back to this built-in layout.
export function LabelDocument({ order }: { order: AdminOrder }) {
  const { data: settings } = useShippingLabelSettings();
  const { data: invoiceSettings } = useInvoiceSettings();
  const shipping = order.addresses.find((a) => (a.type as unknown as string) === "SHIPPING");
  const shipment = order.shipment;

  if (settings?.enabled && settings.template) {
    const tags = buildLabelMergeTags(order, invoiceSettings?.companyName || "Amader");
    const html = renderLabelTemplate(settings.template, tags);
    // eslint-disable-next-line react/no-danger
    return <div className="print:m-0" dangerouslySetInnerHTML={{ __html: html }} />;
  }

  return (
    <div className="mx-auto max-w-md border-2 border-black p-6 text-black print:m-0">
      <div className="mb-4 flex items-center justify-between border-b-2 border-black pb-3">
        <div className="text-lg font-bold">Amader</div>
        <div className="text-right text-xs">
          <div>{order.orderNumber}</div>
          <div>{new Date(order.createdAt).toLocaleDateString()}</div>
        </div>
      </div>

      <p className="text-xs font-bold uppercase text-muted">Deliver to</p>
      <p className="text-lg font-bold">{shipping?.recipientName}</p>
      <p className="text-base">{shipping?.phone}</p>
      <p>{shipping?.addressLine}</p>
      <p>{[shipping?.area, shipping?.district, shipping?.division, shipping?.postCode].filter(Boolean).join(", ")}</p>

      <div className="mt-4 grid grid-cols-2 gap-2 border-t-2 border-black pt-3 text-sm">
        <div><span className="text-muted">Tracking</span><div className="font-bold">{shipment?.trackingCode ?? order.orderNumber}</div></div>
        <div><span className="text-muted">Provider</span><div className="font-bold">{shipment ? String(shipment.provider) : "—"}</div></div>
        <div><span className="text-muted">Weight</span><div className="font-bold">{(shipment?.weight ?? order.totalWeight) ? `${shipment?.weight ?? order.totalWeight} kg` : "—"}</div></div>
        <div><span className="text-muted">Items</span><div className="font-bold">{order.items.reduce((n, i) => n + i.quantity, 0)}</div></div>
      </div>

      <div className="mt-4 border-t-2 border-black pt-3 text-center">
        <p className="text-xs font-bold uppercase text-muted">Cash on delivery</p>
        <p className="text-3xl font-bold">{order.currency} {shipment?.codAmount ?? order.totalAmount}</p>
      </div>
    </div>
  );
}
