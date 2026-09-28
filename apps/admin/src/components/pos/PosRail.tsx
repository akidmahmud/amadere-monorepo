"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { Icon } from "@amader/admin-ui";
import { usePosContext } from "./PosContext";

/** Every POS screen, in rail order; each shows only with its permission. */
export const POS_MENU = [
  { href: "/pos", label: "POS", icon: "grid_view", perm: "pos.access" },
  {
    href: "/pos/orders",
    label: "Orders",
    icon: "receipt_long",
    perm: "pos.orders",
  },
  {
    href: "/pos/customers",
    label: "Customers",
    icon: "group",
    perm: "pos.customers",
  },
  {
    href: "/pos/products",
    label: "Products",
    icon: "category",
    perm: "pos.store_products",
  },
  {
    href: "/pos/stock-in",
    label: "Stock in",
    icon: "inventory",
    perm: "pos.stock_in",
  },
  { href: "/pos/adjust", label: "Adjust", icon: "tune", perm: "pos.adjust" },
  {
    href: "/pos/transfers",
    label: "Transfers",
    icon: "local_shipping",
    perm: "pos.transfer",
  },
  {
    href: "/pos/labels",
    label: "Labels",
    icon: "barcode",
    perm: "pos.labels",
  },
  {
    href: "/pos/reports",
    label: "Reports",
    icon: "bar_chart",
    perm: "pos.reports",
  },
  {
    href: "/pos/settings",
    label: "Settings",
    icon: "settings",
    perm: "pos.settings",
  },
];

const KEY = "pos-rail-collapsed";

/** Left navigation rail on every POS screen (not on the printed receipt). */
export function PosRail() {
  const { can } = usePosContext();
  const path = usePathname();
  // Per-device preference only; failing storage just means "expanded".
  // Read on first render: the rail only mounts client-side, after PosProvider
  // has loaded the admin, so there is no server render to mismatch.
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(KEY) === "1";
    } catch {
      return false;
    }
  });
  const toggle = () =>
    setCollapsed((c) => {
      try {
        localStorage.setItem(KEY, c ? "0" : "1");
      } catch {}
      return !c;
    });

  if (path.startsWith("/pos/receipt")) return null;
  const items = POS_MENU.filter((m) => can(m.perm));
  const active = (href: string) =>
    href === "/pos" ? path === "/pos" : path.startsWith(href);

  return (
    <nav
      aria-label="POS menu"
      className={`sticky top-0 flex h-screen shrink-0 flex-col items-center gap-1 overflow-y-auto border-r border-gray-200 bg-white py-3 print:hidden ${collapsed ? "w-16" : "w-[84px]"}`}
    >
      <button
        onClick={toggle}
        className="mb-2 grid h-10 w-10 place-items-center rounded-lg text-gray-700 hover:bg-gray-100"
        aria-label={collapsed ? "Show menu labels" : "Hide menu labels"}
        aria-expanded={!collapsed}
      >
        <Icon name="menu" size={24} />
      </button>
      {items.map((m) => {
        const on = active(m.href);
        return (
          <Link
            key={m.href}
            href={m.href}
            title={m.label}
            aria-current={on ? "page" : undefined}
            className={`flex flex-col items-center gap-1 rounded-xl py-2.5 text-[11px] font-semibold ${collapsed ? "w-12" : "w-[68px]"} ${on ? "bg-[#1d7a46] text-white" : "text-gray-600 hover:bg-emerald-50 hover:text-[#1d7a46]"}`}
          >
            <Icon name={m.icon} size={22} />
            {!collapsed && <span className="leading-none">{m.label}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
