"use client";

import { useCallback, useEffect, useReducer, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import {
  posLookup,
  usePosCatalog,
  usePosCategories,
  usePosStats,
  type PosCustomer,
} from "@/hooks/usePos";
import { cartReducer, type CartAction } from "@/lib/pos-cart";
import { usePosContext } from "@/components/pos/PosContext";
import { PosTopBar } from "@/components/pos/PosTopBar";
import {
  CategoryChips,
  ProductGrid,
  StatCards,
} from "@/components/pos/ProductGrid";
import { CartPanel } from "@/components/pos/CartPanel";
import { useScanner } from "@/components/pos/useScanner";

export default function PosPage() {
  const { storeId } = usePosContext();
  const toast = useToast();

  const [q, setQ] = useState("");
  const [search, setSearch] = useState("");
  const [categoryId, setCategoryId] = useState<number | undefined>();
  const [sort, setSort] = useState("popular");
  const [view, setView] = useState<"grid" | "list">("grid");
  const [cart, rawDispatch] = useReducer(cartReducer, []);
  const [heldSaleId, setHeldSaleId] = useState<number | undefined>();
  // An emptied cart is no longer the resumed held basket — otherwise the next
  // (different) sale would delete that held basket on completion.
  const dispatch = useCallback((a: CartAction) => {
    if (a.type === "clear") setHeldSaleId(undefined);
    rawDispatch(a);
  }, []);
  const [customer, setCustomer] = useState<PosCustomer | null>(null);
  // A cart emptied line by line is no longer the resumed held basket either.
  if (cart.length === 0 && heldSaleId !== undefined) setHeldSaleId(undefined);

  // Typing searches after a pause; a scan (below) never touches the grid.
  useEffect(() => {
    const t = setTimeout(() => setSearch(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // Switching store empties the cart: its stock numbers belong to the old
  // store. Reset during render (React's "adjust state on prop change").
  const [cartStore, setCartStore] = useState(storeId);
  if (cartStore !== storeId) {
    setCartStore(storeId);
    dispatch({ type: "clear" });
    setHeldSaleId(undefined);
  }

  const catalog = usePosCatalog(storeId, search, categoryId, sort);
  const { data: categories = [] } = usePosCategories();
  const { data: stats } = usePosStats(storeId);

  const addByCode = useCallback(
    async (code: string) => {
      setQ("");
      setSearch("");
      try {
        const p = await posLookup(code, storeId);
        if (p.stock <= 0) toast.push(`${p.name} is out of stock at this store`);
        else dispatch({ type: "add", product: p });
      } catch {
        toast.push(
          `Barcode ${code} not found. If the keyboard is in Bangla mode, switch it to English.`,
        );
      }
    },
    [storeId, toast, dispatch],
  );
  useScanner(addByCode);

  return (
    <div className="flex min-h-screen flex-col lg:h-screen">
      <PosTopBar
        q={q}
        onQ={setQ}
        onEnter={addByCode}
        cart={cart}
        customer={customer}
        heldSaleId={heldSaleId}
        onHeld={() => {
          dispatch({ type: "clear" });
          setCustomer(null);
        }}
        onResume={(h) => {
          if (
            cart.length > 0 &&
            !window.confirm("Replace the current cart with this held sale?")
          )
            return;
          dispatch({ type: "load", lines: h.cart.lines });
          setCustomer(h.cart.customer ?? null);
          setHeldSaleId(h.id);
        }}
      />
      <div className="flex min-h-0 flex-1 flex-col gap-5 p-5 lg:flex-row">
        <main className="flex min-w-0 flex-1 flex-col gap-5 lg:overflow-y-auto lg:pr-1">
          <CategoryChips
            categories={categories}
            value={categoryId}
            onChange={setCategoryId}
          />
          <StatCards stats={stats} activeCustomer={customer ? 1 : 0} />
          <ProductGrid
            items={catalog.data ?? []}
            loading={catalog.isLoading}
            sort={sort}
            onSort={setSort}
            view={view}
            onView={setView}
            onAdd={(p) => dispatch({ type: "add", product: p })}
          />
        </main>
        <CartPanel
          cart={cart}
          dispatch={dispatch}
          storeId={storeId}
          customer={customer}
          onCustomer={setCustomer}
          heldSaleId={heldSaleId}
          onDone={() => {
            dispatch({ type: "clear" });
            setCustomer(null);
            setHeldSaleId(undefined);
          }}
        />
      </div>
    </div>
  );
}
