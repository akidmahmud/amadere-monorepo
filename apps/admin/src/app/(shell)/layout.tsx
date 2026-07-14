"use client";

import { useRouter, usePathname } from "next/navigation";
import { AppShell } from "@amader/admin-ui";
import { adminNav } from "@/lib/nav-config";
import { pageTitleFor } from "@/lib/page-title";
import { useAdminLogout, useAdminMe } from "@/hooks/useAdminAuth";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { data: me } = useAdminMe();
  const logout = useAdminLogout();

  return (
    <AppShell
      logo={
        <>
          <b>Amader</b> Admin
        </>
      }
      nav={adminNav}
      activeHref={pathname}
      userName={me ? `${me.firstName} ${me.lastName}`.trim() || me.email : "…"}
      userSubtitle={me?.email}
      pageTitle={pageTitleFor(pathname)}
      onLogout={async () => {
        await logout.mutateAsync();
        router.push("/login");
      }}
    >
      {children}
    </AppShell>
  );
}
