"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon } from "@amader/admin-ui";
import { proxyFetch } from "@/lib/api/proxy-client";
import { useToast } from "@/components/ToastProvider";
import {
  useDropHeld,
  useHoldSale,
  usePosHeld,
  usePosRecent,
  useReturnSale,
  type HeldSale,
  type PosCustomer,
} from "@/hooks/usePos";
import { taka, type CartLine } from "@/lib/pos-cart";
import { usePosContext } from "./PosContext";
import { CameraScanner } from "./CameraScanner";

const btn =
  "flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-sm font-semibold text-gray-800 hover:border-gray-300 hover:bg-gray-50";

/** Closes when clicking outside. */
function Popover({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) =>
      ref.current && !ref.current.contains(e.target as Node) && onClose();
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div
      ref={ref}
      className="absolute right-0 top-12 z-30 w-96 max-w-[calc(100vw-2rem)] rounded-2xl border border-gray-200 bg-white p-3 shadow-xl"
    >
      {children}
    </div>
  );
}

export function PosTopBar({
  q,
  onQ,
  onEnter,
  cart,
  customer,
  heldSaleId,
  onHeld,
  onResume,
}: {
  q: string;
  onQ: (v: string) => void;
  onEnter: (code: string) => void;
  cart: CartLine[];
  customer: PosCustomer | null;
  /** Set when the current cart was resumed from a held basket. */
  heldSaleId?: number;
  onHeld: () => void;
  onResume: (h: HeldSale) => void;
}) {
  const { can, allStores, stores, storeId, setStoreId, store, userName } =
    usePosContext();
  const toast = useToast();
  const [open, setOpen] = useState<"recent" | "held" | null>(null);
  const close = () => setOpen(null);
  const hold = useHoldSale();
  const held = usePosHeld(storeId);
  const drop = useDropHeld();
  const recent = usePosRecent(storeId);
  const ret = useReturnSale();

  const onHold = () => {
    if (cart.length === 0) return toast.push("Cart is empty");
    const label = window.prompt(
      "Name this held sale (e.g. customer name):",
      `Sale ${new Date().toLocaleTimeString()}`,
    );
    if (!label) return;
    hold.mutate(
      { storeId, label, cart: { lines: cart, customer } },
      {
        onSuccess: () => {
          // Re-holding a resumed basket replaces it rather than duplicating it.
          if (heldSaleId) drop.mutate({ id: heldSaleId, storeId });
          toast.push(`Held: ${label}`, "success");
          onHeld();
        },
        onError: (e) => toast.push(e.message),
      },
    );
  };

  // Site logo, same public setting the storefront header uses.
  const { data: site } = useQuery({
    queryKey: ["site-settings"],
    queryFn: () =>
      proxyFetch<{ logoUrl: string | null; siteName: string | null }>(
        "/settings/site",
      ),
    staleTime: Infinity,
  });
  const searchRef = useRef<HTMLInputElement>(null);
  const [camera, setCamera] = useState(false);
  // F4 = "ready to scan" from anywhere on the till.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "F4") return;
      e.preventDefault();
      searchRef.current?.focus();
      searchRef.current?.select();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const onPosHost =
    typeof window !== "undefined" &&
    window.location.hostname.startsWith("pos.");

  return (
    <header className="flex flex-wrap items-center gap-3 border-b border-gray-200 bg-white px-5 py-3">
      {camera && (
        <CameraScanner
          onClose={() => setCamera(false)}
          onDetected={(code) => {
            setCamera(false);
            onEnter(code);
          }}
        />
      )}
      <div className="flex items-center gap-3 pr-2">
        <a
          href={onPosHost ? "https://admin.amadere.com" : "/"}
          className="grid h-11 w-11 place-items-center rounded-xl border border-gray-200 text-gray-700 hover:bg-gray-50"
          aria-label="Back to admin"
          title="Back to admin"
        >
          <Icon name="arrow_back" size={22} />
        </a>
        {site?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={site.logoUrl}
            alt={site.siteName ?? "Logo"}
            className="h-9 w-auto max-w-[120px] object-contain"
          />
        ) : (
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#1d7a46] text-white">
            <Icon name="storefront" size={24} />
          </span>
        )}
        <span className="h-9 w-px bg-gray-200" aria-hidden />
        <div className="leading-tight">
          <div className="text-xl font-extrabold">POS</div>
          {store && (
            <div className="flex items-center gap-1 text-xs font-semibold text-gray-600">
              {store.name}
              <Icon name="location_on" size={14} className="text-[#1d7a46]" />
            </div>
          )}
        </div>
      </div>

      <label className="flex h-11 min-w-[240px] flex-1 items-center gap-3 rounded-xl border border-gray-200 bg-[#f7f9f8] px-4">
        <Icon name="search" size={20} className="text-gray-500" />
        <input
          ref={searchRef}
          value={q}
          onChange={(e) => onQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && q.trim()) onEnter(q.trim());
          }}
          lang="en"
          inputMode="text"
          placeholder="Search products by name, SKU or barcode..."
          className="h-full flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
        />
        <button
          type="button"
          onClick={() => setCamera(true)}
          className="flex h-8 shrink-0 items-center gap-2 rounded-lg bg-emerald-50 px-2.5 text-sm font-semibold text-[#1d7a46] hover:bg-emerald-100"
          title="Scan with the camera. A barcode scanner works any time; F4 puts the cursor in search."
        >
          <Icon name="barcode_scanner" size={20} /> Scan
          <kbd className="rounded border border-gray-300 bg-white px-1.5 text-[11px] font-semibold text-gray-600">
            F4
          </kbd>
        </button>
      </label>

      {allStores && (
        <select
          value={storeId ?? ""}
          onChange={(e) => setStoreId(Number(e.target.value))}
          className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold"
          aria-label="Store"
        >
          {stores.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
      )}

      <button className={btn} onClick={onHold} disabled={hold.isPending}>
        <Icon name="pause_circle" size={20} /> Hold Sale
      </button>

      <div className="relative">
        <button
          className={btn}
          onClick={() => setOpen(open === "held" ? null : "held")}
        >
          <Icon name="shopping_cart_checkout" size={20} /> Held
          {!!held.data?.length && (
            <span className="rounded-full bg-amber-100 px-2 text-xs font-bold text-amber-800">
              {held.data.length}
            </span>
          )}
        </button>
        <Popover open={open === "held"} onClose={close}>
          <div className="mb-2 text-sm font-bold">Held sales</div>
          {!held.data?.length && (
            <div className="py-4 text-center text-sm text-gray-500">
              Nothing on hold
            </div>
          )}
          {held.data?.map((h) => (
            <div
              key={h.id}
              className="flex items-center justify-between gap-2 border-t border-gray-100 py-2 text-sm"
            >
              <div>
                <div className="font-semibold">{h.label}</div>
                <div className="text-xs text-gray-500">
                  {h.cart.lines.length} items ·{" "}
                  {new Date(h.createdAt).toLocaleTimeString()}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  className="rounded-lg bg-[#1d7a46] px-3 py-1.5 text-xs font-bold text-white"
                  onClick={() => {
                    onResume(h);
                    close();
                  }}
                >
                  Resume
                </button>
                <button
                  className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                  onClick={() => drop.mutate({ id: h.id, storeId })}
                  aria-label="Discard held sale"
                >
                  <Icon name="delete" size={16} />
                </button>
              </div>
            </div>
          ))}
        </Popover>
      </div>

      <div className="relative">
        <button
          className={btn}
          onClick={() => setOpen(open === "recent" ? null : "recent")}
        >
          <Icon name="history" size={20} /> Recent Sales
        </button>
        <Popover open={open === "recent"} onClose={close}>
          <div className="mb-2 text-sm font-bold">Today&apos;s sales</div>
          {!recent.data?.length && (
            <div className="py-4 text-center text-sm text-gray-500">
              No sales yet today
            </div>
          )}
          <div className="max-h-96 overflow-y-auto">
            {recent.data?.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between gap-2 border-t border-gray-100 py-2 text-sm"
              >
                <div>
                  <div className="font-semibold">{s.orderNumber}</div>
                  <div className="text-xs text-gray-500">
                    {new Date(s.createdAt).toLocaleTimeString()} ·{" "}
                    {taka(s.totalAmount)}
                    {s.status === "RETURNED" && (
                      <span className="ml-1 font-bold text-red-600">
                        Returned
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <a
                    href={`/pos/receipt/${s.id}`}
                    target="_blank"
                    rel="noreferrer"
                    className="rounded-lg border border-gray-200 px-2 py-1.5 text-xs font-semibold"
                  >
                    Receipt
                  </a>
                  {can("pos.refund") && s.status !== "RETURNED" && (
                    <button
                      className="rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600"
                      disabled={ret.isPending}
                      onClick={() => {
                        const reason = window.prompt(
                          `Return ${s.orderNumber} (${taka(s.totalAmount)}) in full? Reason:`,
                        );
                        if (reason === null) return;
                        ret.mutate(
                          { id: s.id, reason: reason || undefined },
                          {
                            onSuccess: () =>
                              toast.push("Returned and refunded", "success"),
                            onError: (e) => toast.push(e.message),
                          },
                        );
                      }}
                    >
                      Return
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </Popover>
      </div>

      <div
        className="grid h-11 w-11 place-items-center rounded-full bg-blue-600 text-base font-bold text-white"
        title={userName}
      >
        {userName.charAt(0).toUpperCase() || "?"}
      </div>
    </header>
  );
}
