import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";

// Typed here rather than off `components["schemas"]` because schema.d.ts is
// regenerated from a running backend; these mirror the DTOs in
// apps/backend/src/modules/wholesale/wholesale.mapper.ts.
export type WholesaleCourier =
  | "SUNDARBAN"
  | "AJR"
  | "SA_PARIBAHAN"
  | "OWN_TRANSPORT"
  | "CUSTOMER_PICKUP"
  | "OTHER";
export type WholesaleOrderStatus =
  "PENDING" | "PROCESSING" | "DELIVERED" | "CANCELLED";
export type WholesaleOrderType = "WHOLESALE" | "CASH_SALE";
export type WholesaleOrderChannel =
  | "WHATSAPP"
  | "TELEMARKETING"
  | "FACEBOOK"
  | "INSTAGRAM"
  | "TIKTOK"
  | "MESSENGER"
  | "MARKETPLACE"
  | "PHONE"
  | "IN_STORE_POS"
  | "OTHER";
export type WholesalePaymentMethod =
  | "CASH"
  | "BKASH"
  | "NAGAD"
  | "ROCKET"
  | "UPAY"
  | "BANK";
export type WholesalePaymentStatus = "UNPAID" | "PARTIALLY_PAID" | "PAID";

export const COURIERS: { value: WholesaleCourier; label: string }[] = [
  { value: "SUNDARBAN", label: "সুন্দরবন Courier" },
  { value: "AJR", label: "AJR Courier" },
  { value: "SA_PARIBAHAN", label: "S.A. Paribahan" },
  { value: "OWN_TRANSPORT", label: "Own Transport" },
  { value: "CUSTOMER_PICKUP", label: "Customer Pickup" },
  { value: "OTHER", label: "Other" },
];

export const ORDER_CHANNELS: { value: WholesaleOrderChannel; label: string }[] =
  [
    { value: "WHATSAPP", label: "WhatsApp" },
    { value: "TELEMARKETING", label: "Telemarketing" },
    { value: "FACEBOOK", label: "Facebook" },
    { value: "INSTAGRAM", label: "Instagram" },
    { value: "TIKTOK", label: "TikTok" },
    { value: "MESSENGER", label: "Messenger" },
    { value: "MARKETPLACE", label: "Marketplace" },
    { value: "PHONE", label: "Phone" },
    { value: "IN_STORE_POS", label: "In-store POS" },
    { value: "OTHER", label: "Other" },
  ];

export const PAYMENT_METHODS: {
  value: WholesalePaymentMethod;
  label: string;
}[] = [
  { value: "CASH", label: "Cash" },
  { value: "BKASH", label: "bKash" },
  { value: "NAGAD", label: "Nagad" },
  { value: "ROCKET", label: "Rocket" },
  { value: "UPAY", label: "Upay" },
  { value: "BANK", label: "Bank" },
];

export const PAYMENT_STATUSES: {
  value: WholesalePaymentStatus;
  label: string;
}[] = [
  { value: "UNPAID", label: "Unpaid" },
  { value: "PARTIALLY_PAID", label: "Partially Paid" },
  { value: "PAID", label: "Paid" },
];

export const ORDER_TYPES: { value: WholesaleOrderType; label: string }[] = [
  { value: "WHOLESALE", label: "Wholesale" },
  { value: "CASH_SALE", label: "Cash Sale" },
];

/** Enum -> the label the dashboards print. Falls back to the raw value so a
 *  newly added enum member shows as itself rather than as blank. */
export function labelOf<T extends string>(
  table: { value: T; label: string }[],
  value: T | null | undefined,
): string {
  if (!value) return "";
  return table.find((x) => x.value === value)?.label ?? value;
}

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
  email: string | null;
  alternativePhone: string | null;
  district: string | null;
  thana: string | null;
  landmark: string | null;
  postCode: string | null;
  creditLimit: string | null;
  creditDays: number | null;
  note: string | null;
  isActive: boolean;
  orderCount: number;
  wholesaleCount: number;
  cashCount: number;
  purchaseTotal: string;
  due: string;
  lastOrderAt: string | null;
}

/** Where an order shipped, frozen when it was placed. Null throughout on a
 *  cash sale, which is carried out of the shop. */
export interface WholesaleDelivery {
  recipientName: string | null;
  recipientPhone: string | null;
  alternativePhone: string | null;
  recipientEmail: string | null;
  addressLine: string | null;
  district: string | null;
  thana: string | null;
  landmark: string | null;
  postCode: string | null;
}

/** Headline numbers for both dashboards. Counted server-side over every
 *  order, not over the page the table happens to be showing. */
export interface WholesaleStats {
  orderCount: number;
  wholesaleOrderCount: number;
  cashSaleCount: number;
  salesTotal: string;
  dueTotal: string;
  customerCount: number;
  wholesaleCustomerCount: number;
  cashCustomerCount: number;
}

export interface WholesaleOrderItem {
  id: number;
  productId: number | null;
  variantId: number | null;
  name: string;
  sku: string | null;
  unitPrice: string;
  quantity: number;
  /** Taka off this line, before the order-level discount. */
  discount: string;
  lineTotal: string;
  /** Read off the product now, not snapshotted — null once it is deleted. */
  imageUrl: string | null;
}

export interface WholesaleOrder {
  id: number;
  orderNumber: string;
  partyId: number;
  customerName: string;
  customerPhone: string | null;
  status: WholesaleOrderStatus;
  type: WholesaleOrderType;
  channel: WholesaleOrderChannel | null;
  paymentMethod: WholesalePaymentMethod | null;
  paymentStatus: WholesalePaymentStatus;
  transactionId: string | null;
  /** Counter-sale voucher number. Cash sales only. */
  gpNumber: string | null;
  /** Null on a cash sale — nothing is couriered. */
  courier: WholesaleCourier | null;
  consignmentId: string | null;
  delivery: WholesaleDelivery;
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
  email?: string;
  alternativePhone?: string;
  district?: string;
  thana?: string;
  landmark?: string;
  postCode?: string;
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
    discount?: string;
  }[];
  deliveryCharge?: string;
  discount?: string;
}

export interface OrderInput {
  partyId: number;
  type?: WholesaleOrderType;
  channel?: WholesaleOrderChannel;
  paymentMethod?: WholesalePaymentMethod;
  transactionId?: string;
  gpNumber?: string;
  /** Required for WHOLESALE; a cash sale never touches a courier. */
  courier?: WholesaleCourier;
  consignmentId?: string;
  /** Omitted entirely for a cash sale. */
  delivery?: {
    recipientName?: string;
    recipientPhone?: string;
    alternativePhone?: string;
    recipientEmail?: string;
    addressLine?: string;
    district?: string;
    thana?: string;
    landmark?: string;
    postCode?: string;
  };
  items: {
    productId?: number;
    variantId?: number;
    unitPrice: string;
    quantity: number;
    discount?: string;
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

/** Rows plus the server's total, so a table can page without guessing. */
export interface Page<T> {
  items: T[];
  total: number;
}

export const PAGE_SIZE = 25;

/**
 * One page of buyers.
 *
 * `pageSize: 0` asks for every buyer in one go — what the create-order screen
 * needs, because it searches the list in the browser to keep picking a
 * customer instant while an order is being typed. The dashboards pass a real
 * page size and let the server do the work.
 */
export function useWholesaleCustomers(
  search: string,
  activeOnly: boolean,
  page = 1,
  pageSize: number = PAGE_SIZE,
) {
  return useQuery({
    queryKey: [...CUSTOMERS_KEY, search, activeOnly, page, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize || 500),
      });
      if (search) params.set("search", search);
      if (activeOnly) params.set("isActive", "true");
      const res = await proxyFetch<Paginated<WholesaleCustomer>>(
        `/admin/wholesale/customers?${params}`,
      );
      return { items: res.items ?? [], total: res.total ?? 0 };
    },
    placeholderData: keepPreviousData,
  });
}

export function useWholesaleOrders(
  search: string,
  status: string,
  type: string = "ALL",
  partyId?: number,
  page = 1,
  pageSize: number = PAGE_SIZE,
) {
  return useQuery({
    queryKey: [
      ...ORDERS_KEY,
      search,
      status,
      type,
      partyId ?? null,
      page,
      pageSize,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (search) params.set("search", search);
      if (status !== "ALL") params.set("status", status);
      if (type !== "ALL") params.set("type", type);
      if (partyId) params.set("partyId", String(partyId));
      const res = await proxyFetch<Paginated<WholesaleOrder>>(
        `/admin/wholesale/orders?${params}`,
      );
      return { items: res.items ?? [], total: res.total ?? 0 };
    },
    // Without this the table blanks out on every page step and every
    // keystroke in the search box.
    placeholderData: keepPreviousData,
  });
}

/** Both dashboards' headline cards. Server-counted, so the numbers describe
 *  the business rather than whichever page the table is showing. */
export function useWholesaleStats() {
  return useQuery({
    queryKey: [...ORDERS_KEY, "stats"],
    queryFn: () => proxyFetch<WholesaleStats>("/admin/wholesale/stats"),
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
  /** The bulk rate. Null when none is set, and the order form falls back to
   *  the retail price. */
  wholesalePrice: string | null;
  sku: string | null;
  /** Primary image, or null when the product has none. */
  imageUrl: string | null;
  stockStatus: string;
}

/**
 * What a line should start at for the mode being used.
 *
 * A cash sale is a retail transaction that happens to be recorded here, so it
 * prices at the sale price; a wholesale order prices at the bulk rate. Either
 * way this is only the starting point — the rate that actually bills is
 * whatever is typed on the line, and that is what gets invoiced.
 */
export function defaultUnitPrice(
  product: PickableProduct,
  type: WholesaleOrderType,
): string {
  const retail = product.salePrice ?? product.price ?? "0";
  if (type === "CASH_SALE") return retail;
  return product.wholesalePrice ?? retail;
}

export function useWholesaleProducts() {
  return useQuery({
    queryKey: ["admin-wholesale-products"],
    queryFn: () => proxyFetch<PickableProduct[]>("/admin/wholesale/products"),
  });
}
