import type { AdminOrder } from "@/hooks/useOrders";

// Same {{tag}} substitution convention as SMS/cart-recovery campaign
// templates elsewhere in this codebase — plain string replace, no template
// engine. Shared by the settings page's live preview and LabelDocument so
// both ever compute merge tags exactly one way.
export function buildLabelMergeTags(order: AdminOrder, companyName: string): Record<string, string> {
  const shipping = order.addresses.find((a) => (a.type as unknown as string) === "SHIPPING");
  const shipment = order.shipment;
  const weight = shipment?.weight ?? order.totalWeight;

  return {
    companyName,
    orderNumber: order.orderNumber,
    date: new Date(order.createdAt).toLocaleDateString(),
    recipientName: shipping?.recipientName ?? "",
    phone: shipping?.phone ?? "",
    addressLine: shipping?.addressLine ?? "",
    addressFull: [shipping?.area, shipping?.district, shipping?.division, shipping?.postCode].filter(Boolean).join(", "),
    trackingCode: shipment?.trackingCode ?? order.orderNumber,
    provider: shipment ? String(shipment.provider) : "—",
    weight: weight ? String(weight) : "—",
    itemCount: String(order.items.reduce((n, i) => n + i.quantity, 0)),
    codAmount: shipment?.codAmount ?? order.totalAmount,
    currency: order.currency,
  };
}

export function renderLabelTemplate(template: string, tags: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => tags[key] ?? "");
}
