"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { useRouter } from "@/i18n/navigation";
import { AccountNav } from "@/components/AccountNav";
import { useMe } from "@/hooks/useAuth";

export function AccountShell({ children }: { children: React.ReactNode }) {
  const { data: me, isLoading } = useMe();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && me === null) {
      router.replace(`/login?redirect=${encodeURIComponent(pathname)}`);
    }
  }, [isLoading, me, pathname, router]);

  if (isLoading || !me) {
    return <div className="mx-auto max-w-[1180px] px-5 py-16 text-center font-body text-sm text-muted">Loading…</div>;
  }

  return (
    <div className="mx-auto flex max-w-[1180px] gap-8 px-5 py-9 max-md:flex-col">
      <AccountNav />
      <div className="flex-1">{children}</div>
    </div>
  );
}
