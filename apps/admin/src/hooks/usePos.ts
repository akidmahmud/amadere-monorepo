import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { proxyFetch } from "@/lib/api/proxy-client";
import type { CartLine, PosProduct } from "@/lib/pos-cart";

export const qs = (o: Record<string, string | number | undefined | null>) => {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(o))
    if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? `?${s}` : "";
};

export interface PosStore {
  id: number;
  name: string;
  code: string;
  address: string | null;
  phone: string | null;
  isOnlineStore: boolean;
  isActive: boolean;
  costCentreId: number | null;
  cashAccountId: number | null;
  cardAccountId: number | null;
  mobileAccountId: number | null;
  staffCount: number;
  /** Only for stores.manage / pos.all_stores; empty otherwise. */
  staff: { id: number; firstName: string; lastName: string; email: string }[];
}

export interface PosCustomer {
  id: number;
  name: string;
  phone: string | null;
}

export interface PosSale {
  id: number;
  storeId: number | null;
  tenderedAmount: string | null;
  orderNumber: string;
  status: string;
  subTotal: string;
  discountAmount: string;
  taxAmount: string;
  totalAmount: string;
  createdAt: string;
  items: {
    id: number;
    productNameSnapshot: string;
    variantLabel?: string | null;
    quantity: number;
    unitPrice: string;
  }[];
  payments: {
    provider: string;
    amount: string;
    transactionRef: string | null;
  }[];
  store: {
    name: string;
    address?: string | null;
    phone?: string | null;
  } | null;
  customer?: {
    firstName: string | null;
    lastName: string | null;
    phone: string | null;
  } | null;
  assignedAdmin?: { firstName: string; lastName: string } | null;
}

export interface HeldSale {
  id: number;
  label: string;
  cart: { lines: CartLine[]; customer?: PosCustomer | null };
  createdAt: string;
}

/** Everything that changes when stock or sales move. */
function invalidatePos(qc: ReturnType<typeof useQueryClient>) {
  for (const key of [
    "pos-catalog",
    "pos-stats",
    "pos-held",
    "pos-recent",
    "pos-movements",
    "pos-transfers",
  ]) {
    qc.invalidateQueries({ queryKey: [key] });
  }
}

export function usePosCatalog(
  storeId: number | undefined,
  q: string,
  categoryId: number | undefined,
  sort: string,
) {
  return useQuery({
    queryKey: ["pos-catalog", storeId, q, categoryId, sort],
    queryFn: () =>
      proxyFetch<PosProduct[]>(
        `/admin/pos/catalog${qs({ storeId, q, categoryId, sort })}`,
      ),
  });
}

export const usePosCategories = () =>
  useQuery({
    queryKey: ["pos-categories"],
    queryFn: () =>
      proxyFetch<{ id: number; name: string }[]>("/admin/pos/categories"),
    staleTime: 5 * 60_000,
  });

export const usePosStats = (storeId?: number) =>
  useQuery({
    queryKey: ["pos-stats", storeId],
    queryFn: () =>
      proxyFetch<{
        totalProducts: number;
        lowStock: number;
        todaySales: string;
      }>(`/admin/pos/stats${qs({ storeId })}`),
  });

export const usePosStores = (enabled = true) =>
  useQuery({
    queryKey: ["stores"],
    queryFn: () => proxyFetch<PosStore[]>("/admin/stores"),
    enabled,
  });

export const posLookup = (code: string, storeId?: number) =>
  proxyFetch<PosProduct>(`/admin/pos/lookup${qs({ code, storeId })}`);

export interface SaleBody {
  storeId?: number;
  items: { productId: number; variantId?: number; quantity: number }[];
  customerId?: number;
  couponCode?: string;
  tender: "CASH" | "CARD" | "MOBILE";
  tenderedAmount?: number;
  transactionRef?: string;
  heldSaleId?: number;
}

export function useCompleteSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: SaleBody) =>
      proxyFetch<{
        orderId: number;
        orderNumber: string;
        total: string;
        change: string;
      }>("/admin/pos/sales", {
        method: "POST",
        body: JSON.stringify(body),
      }),
    onSuccess: () => invalidatePos(qc),
  });
}

export const usePosHeld = (storeId?: number) =>
  useQuery({
    queryKey: ["pos-held", storeId],
    queryFn: () => proxyFetch<HeldSale[]>(`/admin/pos/held${qs({ storeId })}`),
  });

export function useHoldSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (b: {
      storeId?: number;
      label: string;
      cart: { lines: CartLine[]; customer?: PosCustomer | null };
    }) =>
      proxyFetch("/admin/pos/held", {
        method: "POST",
        body: JSON.stringify(b),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-held"] }),
  });
}

export function useDropHeld() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { id: number; storeId?: number }) =>
      proxyFetch(`/admin/pos/held/${a.id}${qs({ storeId: a.storeId })}`, {
        method: "DELETE",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pos-held"] }),
  });
}

export const usePosRecent = (storeId?: number, date?: string) =>
  useQuery({
    queryKey: ["pos-recent", storeId, date],
    queryFn: () =>
      proxyFetch<PosSale[]>(`/admin/pos/sales${qs({ storeId, date })}`),
  });

export const usePosSale = (id: number) =>
  useQuery({
    queryKey: ["pos-sale", id],
    queryFn: () => proxyFetch<PosSale>(`/admin/pos/sales/${id}`),
  });

export function useReturnSale() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { id: number; reason?: string }) =>
      proxyFetch<PosSale>(`/admin/pos/sales/${a.id}/return`, {
        method: "POST",
        body: JSON.stringify({ reason: a.reason }),
      }),
    onSuccess: () => invalidatePos(qc),
  });
}

export const searchPosCustomers = (q: string) =>
  proxyFetch<PosCustomer[]>(`/admin/pos/customers${qs({ q })}`);

export const quickAddCustomer = (phone: string, name?: string) =>
  proxyFetch<PosCustomer>("/admin/pos/customers", {
    method: "POST",
    body: JSON.stringify({ phone, name }),
  });

// ---- stock documents --------------------------------------------------------

export interface Movement {
  id: number;
  type: string;
  qty: number;
  reason: string | null;
  createdAt: string;
  store: { name: string };
}

export const useMovements = (
  productId?: number,
  variantId?: number | null,
  storeId?: number,
) =>
  useQuery({
    queryKey: ["pos-movements", productId, variantId, storeId],
    queryFn: () =>
      proxyFetch<Movement[]>(
        `/admin/stock/movements${qs({ productId, variantId, storeId })}`,
      ),
    enabled: !!productId,
  });

export function useStockPost<TBody, TResult = unknown>(path: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body: TBody) =>
      proxyFetch<TResult>(path, { method: "POST", body: JSON.stringify(body) }),
    onSuccess: () => invalidatePos(qc),
  });
}

export interface Transfer {
  id: number;
  number: string;
  status: "REQUESTED" | "APPROVED" | "DISPATCHED" | "RECEIVED" | "CANCELLED";
  fromStoreId: number;
  toStoreId: number;
  note: string | null;
  createdAt: string;
  fromStore: { name: string };
  toStore: { name: string };
  items: {
    id: number;
    productId: number;
    variantId: number | null;
    qty: number;
    receivedQty: number | null;
    name: string;
  }[];
}

export const useTransfers = (storeId?: number) =>
  useQuery({
    queryKey: ["pos-transfers", storeId],
    queryFn: () =>
      proxyFetch<Transfer[]>(`/admin/stock/transfers${qs({ storeId })}`),
  });

// ---- POS Settings ----------------------------------------------------------

export interface PosVat {
  enabled: boolean;
  ratePercent: number;
  pricesIncludeVat: boolean;
}

export const usePosVat = () =>
  useQuery({
    queryKey: ["pos-vat"],
    queryFn: () => proxyFetch<PosVat>("/admin/pos/settings/vat"),
  });

export function useSavePosVat() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: PosVat) =>
      proxyFetch<PosVat>("/admin/pos/settings/vat", {
        method: "PUT",
        body: JSON.stringify(v),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-vat"] });
      qc.invalidateQueries({ queryKey: ["pos-quote"] });
    },
  });
}

export interface InvoiceSlot {
  storeId: number | null;
  storeName: string;
  hasOwn: boolean;
  updatedAt: string | null;
}

export const useInvoiceSlots = () =>
  useQuery({
    queryKey: ["pos-invoices"],
    queryFn: () => proxyFetch<InvoiceSlot[]>("/admin/pos/invoice-templates"),
  });

export const invoiceKey = (storeId: number | null) =>
  storeId === null ? "default" : String(storeId);

export const useInvoiceTemplate = (storeId: number | null) =>
  useQuery({
    queryKey: ["pos-invoice", storeId],
    queryFn: () =>
      proxyFetch<{ html: string | null }>(
        `/admin/pos/invoice-templates/${invoiceKey(storeId)}`,
      ),
  });

export const useResolvedInvoice = (storeId: number | null | undefined) =>
  useQuery({
    queryKey: ["pos-invoice-resolve", storeId],
    queryFn: () =>
      proxyFetch<{ html: string | null; source: string }>(
        `/admin/pos/invoice-templates/resolve${qs({ storeId })}`,
      ),
    enabled: storeId != null,
  });

export function useSaveInvoice() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (a: { storeId: number | null; html: string | null }) =>
      a.html === null
        ? proxyFetch(`/admin/pos/invoice-templates/${invoiceKey(a.storeId)}`, {
            method: "DELETE",
          })
        : proxyFetch<{ html: string }>(
            `/admin/pos/invoice-templates/${invoiceKey(a.storeId)}`,
            {
              method: "PUT",
              body: JSON.stringify({ html: a.html }),
            },
          ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-invoices"] });
      qc.invalidateQueries({ queryKey: ["pos-invoice"] });
      qc.invalidateQueries({ queryKey: ["pos-invoice-resolve"] });
    },
  });
}
