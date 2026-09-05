"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  AppShell,
  type AppNavEntry,
  type AppNotification,
} from "@amader/admin-ui";
import { adminNav } from "@/lib/nav-config";
import { pageTitleFor } from "@/lib/page-title";
import { useAdminLogout, useAdminMe } from "@/hooks/useAdminAuth";
import {
  useAbandonedCartNotifications,
  useAbandonmentAlert,
} from "@/hooks/useAbandonmentAlert";
import { useNewOrderAlert } from "@/hooks/useNewOrderAlert";
import { usePendingOrderCount } from "@/hooks/useOrderManager";

// A super admin sees every row (matches the backend PermissionGuard's own
// bypass). Anyone else only sees rows whose `permission` they've been
// granted via a role — rows with no `permission` (e.g. Documentation) stay
// visible to everyone. AppShell already drops a section label whose group
// ends up with zero visible items, so filtering here is all that's needed.
function filterNavByPermissions(
  nav: AppNavEntry[],
  isSuperAdmin: boolean,
  granted: Set<string>,
): AppNavEntry[] {
  if (isSuperAdmin) return nav;
  return nav.filter(
    (entry) =>
      !("permission" in entry) ||
      !entry.permission ||
      granted.has(entry.permission),
  );
}

export default function ShellLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useAdminMe();
  const logout = useAdminLogout();

  // Nothing while `me` hasn't loaded yet — avoids a flash of every row
  // (including ones a non-super-admin doesn't have) before the real
  // permission set arrives.
  // Only poll for abandoned carts when this admin may actually see them --
  // otherwise the request 403s once a minute for everyone else.
  const canSeeRecovery =
    !!me &&
    (me.isSuperAdmin || me.permissions.includes("net_profit_recovery.manage"));
  const abandonment = useAbandonmentAlert(canSeeRecovery);

  // Gated the same way as the abandoned-cart poll: without order.view the
  // request 403s every 30 seconds for anyone who cannot see orders anyway.
  const canSeeOrders =
    !!me && (me.isSuperAdmin || me.permissions.includes("order.view"));
  const orderAlert = useNewOrderAlert(canSeeOrders);

  // Sidebar workload badges. Deliberately NOT the bell's `unseen` counts: the
  // bell answers "what arrived since I last looked", which resets the moment
  // someone opens the dropdown. A badge on a nav row has to answer "how much
  // is waiting behind this link", or it contradicts the page it points at.
  const pendingOrders = usePendingOrderCount(canSeeOrders);

  // The abandoned-cart ROWS are fetched only after the bell has been opened
  // once — they carry cart snapshots, and the cheap count-only poll in
  // useAbandonmentAlert exists precisely so every admin isn't pulling them
  // every minute just to keep a closed dropdown warm.
  const [bellOpened, setBellOpened] = useState(false);
  const abandonedCarts = useAbandonedCartNotifications(
    canSeeRecovery && bellOpened,
  );

  // One bell, both kinds of notification: new orders first (time-sensitive),
  // then a single roll-up row for abandoned carts rather than one row per
  // cart — the Recovery page is the place to actually work through those.
  const notifications: AppNotification[] = [
    ...orderAlert.notifications.map((o) => ({
      id: `order-${o.id}`,
      title: `New order ${o.orderNumber}`,
      subtitle: `${o.currency} ${o.totalAmount}`,
      meta: new Date(o.createdAt).toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
      }),
      href: `/net-profit/orders?search=${encodeURIComponent(o.orderNumber)}`,
      unread: o.unread,
      type: "order" as const,
    })),
    ...abandonedCarts.map((c) => {
      // Total quantity, not `cart.length` — that counts LINES, so a cart
      // holding 2 of one product read "1 item".
      const itemCount = c.cart.reduce((sum, line) => sum + line.quantity, 0);
      return {
        id: `cart-${c.id}`,
        title: `Abandoned cart — ${c.name?.trim() || "Anonymous shopper"}`,
        subtitle: `${itemCount} item${itemCount === 1 ? "" : "s"} · BDT ${c.subtotal}${c.phone ? ` · ${c.phone}` : ""}`,
        meta: new Date(c.lastSeenAt).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
        href: "/net-profit/recovery",
        unread: false,
        type: "cart" as const,
      };
    }),
    // Shown until the rows themselves arrive (they are only fetched once the
    // panel has been opened), so the first open is never an empty panel when
    // the badge said there was something.
    ...(abandonment.unseen > 0 && abandonedCarts.length === 0
      ? [
          {
            id: "abandoned-carts",
            title: `${abandonment.unseen} new abandoned cart${abandonment.unseen === 1 ? "" : "s"}`,
            subtitle: "Open Recovery to follow them up",
            href: "/net-profit/recovery",
            unread: true,
            type: "cart" as const,
          },
        ]
      : []),
  ];

  // Opening Recovery any way at all counts as having seen it — via the bell,
  // the sidebar, a bookmark or a link from elsewhere. Without this the dot
  // would sit there while the admin is literally looking at the page.
  useEffect(() => {
    if (pathname === "/net-profit/recovery" && abandonment.unseen > 0) {
      abandonment.acknowledge();
    }
  }, [pathname, abandonment]);

  const nav = useMemo(() => {
    if (!me) return [];
    const visible = filterNavByPermissions(
      adminNav,
      me.isSuperAdmin,
      new Set(me.permissions),
    );

    // Counts on the two rows that carry a live queue.
    const badges: Record<string, number> = {
      "/net-profit/orders": pendingOrders,
      "/net-profit/recovery": abandonment.total,
    };
    const withBadges = visible.map((entry) =>
      "href" in entry && badges[entry.href]
        ? { ...entry, badge: badges[entry.href] }
        : entry,
    );
    // No red dot on Recovery any more. It used to mark "something new arrived",
    // but the row now carries the actual count, and a dot sitting where a
    // number belongs just reads as a number that failed to load. Zero waiting
    // means nothing is drawn, which is the honest state.
    return withBadges;
  }, [me, abandonment.total, pendingOrders]);

  return (
    <AppShell
      logo={
        <>
          <b>Amader</b> Admin
        </>
      }
      nav={nav}
      activeHref={pathname}
      linkComponent={Link}
      userName={me ? `${me.firstName} ${me.lastName}`.trim() || me.email : "…"}
      userSubtitle={me?.email}
      pageTitle={pageTitleFor(pathname)}
      hasNotification={abandonment.unseen > 0 || orderAlert.unseen > 0}
      notificationCount={orderAlert.unseen + (abandonment.unseen > 0 ? 1 : 0)}
      notifications={notifications}
      onNotificationsOpen={() => {
        setBellOpened(true);
        // Opening the panel is seeing them — both sources at once, so the
        // badge clears rather than leaving a stale half-count behind.
        orderAlert.acknowledge();
        abandonment.acknowledge();
      }}
      onLogout={async () => {
        await logout.mutateAsync();
        router.push("/login");
      }}
    >
      {children}
    </AppShell>
  );
}
