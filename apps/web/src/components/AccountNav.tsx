"use client";

import { usePathname, Link, useRouter } from "@/i18n/navigation";
import { useLogout } from "@/hooks/useAuth";

const SECTIONS = [
  { href: "/account", label: "Profile" },
  { href: "/account/orders", label: "Orders" },
  { href: "/account/wishlist", label: "Wishlist" },
  { href: "/account/addresses", label: "Addresses" },
  { href: "/account/reviews", label: "My Reviews" },
];

export function AccountNav() {
  const pathname = usePathname();
  const router = useRouter();
  const logout = useLogout();

  return (
    <nav className="w-[220px] shrink-0 max-md:w-full">
      <ul className="space-y-1">
        {SECTIONS.map((section) => (
          <li key={section.href}>
            <Link
              href={section.href}
              className={`block rounded-lg px-3.5 py-2.5 font-ui text-sm ${
                pathname === section.href ? "bg-green text-white" : "text-ink hover:bg-beige"
              }`}
            >
              {section.label}
            </Link>
          </li>
        ))}
        <li>
          <button
            type="button"
            onClick={() => logout.mutate(undefined, { onSuccess: () => router.push("/") })}
            className="block w-full rounded-lg px-3.5 py-2.5 text-left font-ui text-sm text-red-600 hover:bg-beige"
          >
            Log Out
          </button>
        </li>
      </ul>
    </nav>
  );
}
