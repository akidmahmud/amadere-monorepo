"use client";

import { createContext, useContext, useState } from "react";
import { useAdminMe } from "@/hooks/useAdminAuth";
import { usePosStores, type PosStore } from "@/hooks/usePos";

interface PosContextValue {
  can: (key: string) => boolean;
  allStores: boolean;
  /** Sent as ?storeId= — undefined lets the server use the user's own store. */
  storeId: number | undefined;
  setStoreId: (id: number) => void;
  store: PosStore | undefined;
  stores: PosStore[];
  userName: string;
}

const Ctx = createContext<PosContextValue | null>(null);

export function usePosContext(): PosContextValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("usePosContext outside PosProvider");
  return v;
}

const KEY = "pos-store-id";

export function PosProvider({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useAdminMe();
  const can = (k: string) =>
    !!me && (me.isSuperAdmin || me.permissions.includes(k));
  const allStores = can("pos.all_stores");
  const { data: stores = [], isSuccess: storesLoaded } = usePosStores(
    !!me && can("pos.access"),
  );
  // Remember an all-stores user's last store per browser (a convenience only).
  const [picked, setPicked] = useState<number | undefined>(() => {
    try {
      return Number(localStorage.getItem(KEY)) || undefined;
    } catch {
      return undefined; // SSR or storage blocked: default store is fine
    }
  });

  if (isLoading || !me)
    return (
      <div className="grid h-screen place-items-center text-gray-500">
        Loading…
      </div>
    );
  if (!can("pos.access")) {
    return (
      <div className="grid h-screen place-items-center px-4 text-center text-gray-700">
        You don&apos;t have access to the POS. Ask an admin to give your role
        the POS permission.
      </div>
    );
  }
  if (!me.storeId && !allStores) {
    return (
      <div className="grid h-screen place-items-center px-4 text-center text-gray-700">
        No store assigned — ask an admin.
      </div>
    );
  }

  const activeId = allStores
    ? stores.some((s) => s.id === picked)
      ? picked
      : stores[0]?.id
    : (me.storeId ?? undefined);
  // An all-stores user acts on a store they pick; wait for the list rather
  // than firing store-less requests the server would reject.
  if (allStores && activeId === undefined) {
    return (
      <div className="grid h-screen place-items-center px-4 text-center text-gray-700">
        {storesLoaded
          ? "No stores yet — create one under Admin › Stores."
          : "Loading…"}
      </div>
    );
  }
  const value: PosContextValue = {
    can,
    allStores,
    storeId: allStores ? activeId : undefined,
    setStoreId: (id) => {
      setPicked(id);
      try {
        localStorage.setItem(KEY, String(id));
      } catch {
        /* ignore */
      }
    },
    store: stores.find((s) => s.id === activeId),
    stores,
    userName: `${me.firstName} ${me.lastName}`.trim(),
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
