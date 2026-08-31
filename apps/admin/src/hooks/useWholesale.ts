import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

// Typed here rather than off `components["schemas"]` because schema.d.ts is
// regenerated from a running backend; these mirror the DTOs in
// apps/backend/src/modules/wholesale/wholesale.mapper.ts.
export type WholesaleCourier = "SUNDARBAN" | "AJR";
export type WholesaleOrderStatus =
  "PENDING" | "PROCESSING" | "DELIVERED" | "CANCELLED";

export const COURIERS: { value: WholesaleCourier; label: string }[] = [
  { value: "SUNDARBAN", label: "সুন্দরবন Courier" },
  { value: "AJR", label: "AJR Courier" },
];

export const ORDER_STATUSES: { value: WholesaleOrderStatus; label: string }[] =
  [
    { value: "PENDING", label: "Pending" },
    { value: "PROCESSING", label: "Processing" },
    { value: "DELIVERED", label: "Delivered" },
    { value: "CANCELLED", label: "Cancelled" },
  ];

export interface WholesaleCustomer {
  id: number;
  name: string;
  phone: string | null;
  address: string | null;
  creditLimit: string | null;
  creditDays: number | null;
  note: string | null;
  isActive: boolean;
  orderCount: number;
  purchaseTotal: string;
  due: string;
}

export interface WholesaleOrderItem {
  id: number;
  productId: number | null;
  variantId: number | null;
  name: string;
  sku: string | null;
  unitPrice: string;
  quantity: number;
  lineTotal: string;
}

export interface WholesaleOrder {
  id: number;
  orderNumber: string;
  partyId: number;
  customerName: string;
  customerPhone: string | null;
  status: WholesaleOrderStatus;
  courier: WholesaleCourier;
  consignmentId: string | null;
  subtotal: string;
  deliveryCharge: string;
  discount: string;
  total: string;
  paid: string;
  due: string;
  invoiceDocNo: string | null;
  note: string | null;
  placedAt: string;
  items: WholesaleOrderItem[];
}

export interface CustomerInput {
  name: string;
  phone: string;
  address?: string;
  creditLimit?: string;
  creditDays?: number;
  openingReceivable?: string;
  note?: string;
  isActive?: boolean;
}

/** What an edit may change. Lines and money are optional: omitting them
 *  edits only the light fields, which is what the row controls do. */
export interface OrderEditInput {
  status?: WholesaleOrderStatus;
  courier?: WholesaleCourier;
  consignmentId?: string;
  note?: string;
  items?: {
    productId?: number;
    variantId?: number;
    unitPrice: string;
    quantity: number;
  }[];
  deliveryCharge?: string;
  discount?: string;
}

export interface OrderInput {
  partyId: number;
  courier: WholesaleCourier;
  consignmentId?: string;
  items: {
    productId?: number;
    variantId?: number;
    unitPrice: string;
    quantity: number;
  }[];
  deliveryCharge?: string;
  discount?: string;
  paidAmount?: string;
  status?: WholesaleOrderStatus;
  note?: string;
}

type Paginated<T> = { items?: T[]; total?: number };

const CUSTOMERS_KEY = ["admin-wholesale-customers"];
const ORDERS_KEY = ["admin-wholesale-orders"];

// One invalidation helper: an order changes a buyer's order count, lifetime
// purchase and outstanding balance, so the customers list is never still
// correct after an order write.
function useInvalidateAll() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: ORDERS_KEY });
    void qc.invalidateQueries({ queryKey: CUSTOMERS_KEY });
  };
}

export function useWholesaleCustomers(search: string, activeOnly: boolean) {
  return useQuery({
    queryKey: [...CUSTOMERS_KEY, search, activeOnly],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "200" });
      if (search) params.set("search", search);
      if (activeOnly) params.set("isActive", "true");
      const res = await proxyFetch<Paginated<WholesaleCustomer>>(
        `/admin/wholesale/customers?${params}`,
      );
      return res.items ?? [];
    },
  });
}

export function useWholesaleOrders(search: string, status: string) {
  return useQuery({
    queryKey: [...ORDERS_KEY, search, status],
    queryFn: async () => {
      const params = new URLSearchParams({ pageSize: "200" });
      if (search) params.set("search", search);
      if (status !== "ALL") params.set("status", status);
      const res = await proxyFetch<Paginated<WholesaleOrder>>(
        `/admin/wholesale/orders?${params}`,
      );
      return res.items ?? [];
    },
  });
}

export function useSaveWholesaleCustomer() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...input }: CustomerInput & { id?: number }) =>
      proxyFetch<WholesaleCustomer>(
        id ? `/admin/wholesale/customers/${id}` : "/admin/wholesale/customers",
        { method: id ? "PATCH" : "POST", body: JSON.stringify(input) },
      ),
    onSuccess: invalidate,
  });
}

export function useDeleteWholesaleCustomer() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: number) =>
      proxyFetch<{ id: number }>(`/admin/wholesale/customers/${id}`, {
        method: "DELETE",
      }),
    onSuccess: invalidate,
  });
}

export function useCreateWholesaleOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (input: OrderInput) =>
      proxyFetch<WholesaleOrder>("/admin/wholesale/orders", {
        method: "POST",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

/**
 * Edits a placed order.
 *
 * Sending only the light fields (status/courier/consignment/note) changes
 * nothing else. Sending `items` — or either money field — restates the sale:
 * the server moves stock by the difference and rewrites the invoice to the
 * new total. It refuses to restate below what has already been collected.
 */
export function useUpdateWholesaleOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, ...input }: OrderEditInput & { id: number }) =>
      proxyFetch<WholesaleOrder>(`/admin/wholesale/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify(input),
      }),
    onSuccess: invalidate,
  });
}

/** One order, for the print/invoice route which has only an id. */
export function useWholesaleOrder(id: number) {
  return useQuery({
    queryKey: [...ORDERS_KEY, "one", id],
    queryFn: () => proxyFetch<WholesaleOrder>(`/admin/wholesale/orders/${id}`),
    enabled: Number.isFinite(id) && id > 0,
  });
}

/** Print view for an order — the browser's own dialog also does Save as PDF. */
export function wholesaleInvoiceHref(id: number) {
  return `/print/wholesale/${id}/invoice`;
}

/**
 * Download the orders list as CSV, honouring the filters currently applied.
 *
 * Goes through the same `/api/backend` proxy as every other admin call so the
 * Bearer token is attached; a plain <a href> to the API would be unauthenticated.
 * The response is a file, not the JSON envelope, so it is read as a blob rather
 * than through proxyFetch.
 */
export async function downloadWholesaleOrdersCsv(
  search: string,
  status: string,
) {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  if (status && status !== "ALL") params.set("status", status);

  const res = await fetch(
    `/api/backend/admin/wholesale/orders/export?${params}`,
  );
  if (!res.ok) throw new Error("Couldn't export the orders");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `wholesale-orders-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export function useRecordWholesalePayment() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: ({ id, amount }: { id: number; amount: string }) =>
      proxyFetch<WholesaleOrder>(`/admin/wholesale/orders/${id}/payments`, {
        method: "POST",
        body: JSON.stringify({ amount }),
      }),
    onSuccess: invalidate,
  });
}

export function useCancelWholesaleOrder() {
  const invalidate = useInvalidateAll();
  return useMutation({
    mutationFn: (id: number) =>
      proxyFetch<WholesaleOrder>(`/admin/wholesale/orders/${id}/cancel`, {
        method: "POST",
      }),
    onSuccess: invalidate,
  });
}

/**
 * Product picker source for the order form.
 *
 * Served by /admin/wholesale/products, not /admin/products/picker — same list,
 * but gated on wholesale.view so staff who only manage wholesale are not left
 * with an empty dropdown and an unexplained 403.
 */
export interface PickableProduct {
  id: number;
  slug: string;
  name: string;
  price: string | null;
  salePrice: string | null;
  stockStatus: string;
}

export function useWholesaleProducts() {
  return useQuery({
    queryKey: ["admin-wholesale-products"],
    queryFn: () => proxyFetch<PickableProduct[]>("/admin/wholesale/products"),
  });
}
