"use client";

import { useMemo } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { AppShell, type AppNavEntry } from "@amader/admin-ui";
import { adminNav } from "@/lib/nav-config";
import { pageTitleFor } from "@/lib/page-title";
import { useAdminLogout, useAdminMe } from "@/hooks/useAdminAuth";
import { useAbandonmentAlert } from "@/hooks/useAbandonmentAlert";

// A super admin sees every row (matches the backend PermissionGuard's own
// bypass). Anyone else only sees rows whose `permission` they've been
// granted via a role — rows with no `permission` (e.g. Documentation) stay
// visible to everyone. AppShell already drops a section label whose group
// ends up with zero visible items, so filtering here is all that's needed.
function filterNavByPermissions(nav: AppNavEntry[], isSuperAdmin: boolean, granted: Set<string>): AppNavEntry[] {
  if (isSuperAdmin) return nav;
  return nav.filter((entry) => !("permission" in entry) || !entry.permission || granted.has(entry.permission));
}

export default function ShellLayout({ children }: { children: React.ReactNode }) {
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
    !!me && (me.isSuperAdmin || me.permissions.includes("net_profit_recovery.manage"));
  const abandonment = useAbandonmentAlert(canSeeRecovery);

  const nav = useMemo(
    () => (me ? filterNavByPermissions(adminNav, me.isSuperAdmin, new Set(me.permissions)) : []),
    [me],
  );

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
      hasNotification={abandonment.unseen > 0}
      onNotificationClick={() => {
        abandonment.acknowledge();
        router.push("/net-profit/recovery");
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
