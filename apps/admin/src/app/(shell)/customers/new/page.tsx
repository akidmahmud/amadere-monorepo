"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useCreateCustomer } from "@/hooks/useCustomers";
import { ProxyApiError } from "@/lib/api/proxy-client";

// Same visual language as the Customer Management list page
// (apps/admin/src/app/(shell)/customers/page.tsx) — this form used to be a
// plain generic admin-ui Card, inconsistent with that page's green palette.
const GREEN = "#2e7d43";
const GREEN_DARK = "#1d5230";
const LINE = "#e5ebe6";
const INK = "#1e2b22";
const MUTED = "#64766b";
const TEXT = "#374840";

const inputClass = "h-11 w-full rounded-[9px] border px-3.5 text-sm outline-none";
const inputStyle = { borderColor: LINE, color: TEXT, background: "#fff" } as const;

export default function NewCustomerPage() {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const create = useCreateCustomer();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({
      phone,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email: email || undefined,
    });
    // Back to the Customer Management list, not the new customer's own
    // detail page — the list is where the newly created row is visible.
    router.push("/customers");
  }

  return (
    <div className="flex flex-col gap-[18px]">
      <div>
        <h1 className="text-[1.45rem] font-extrabold tracking-tight" style={{ color: INK }}>
          Add Customer
        </h1>
        <div className="mt-1.5 flex items-center gap-1.5 text-[0.76rem] font-semibold" style={{ color: MUTED }}>
          Dashboard <span style={{ color: "#94a69a" }}>›</span>{" "}
          <Link href="/customers" style={{ color: GREEN }}>
            Customers
          </Link>{" "}
          <span style={{ color: "#94a69a" }}>›</span> <span style={{ color: GREEN }}>New</span>
        </div>
      </div>

      <div className="max-w-lg rounded-card border p-[22px]" style={{ background: "#fff", borderColor: LINE }}>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.78rem] font-bold" style={{ color: TEXT }}>
              Phone
            </span>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputClass}
              style={inputStyle}
              pattern="(?:\+?880|0)?1\d{9}"
              title="Enter a valid Bangladeshi mobile number, e.g. 01712345678"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.78rem] font-bold" style={{ color: TEXT }}>
              First name (optional)
            </span>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className={inputClass} style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.78rem] font-bold" style={{ color: TEXT }}>
              Last name (optional)
            </span>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className={inputClass} style={inputStyle} />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[0.78rem] font-bold" style={{ color: TEXT }}>
              Email (optional)
            </span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} style={inputStyle} />
          </label>

          {create.error && (
            <p className="text-[0.8rem] font-semibold" style={{ color: "#e5484d" }}>
              {create.error instanceof ProxyApiError ? create.error.message : "Failed to create customer"}
            </p>
          )}

          <div className="mt-1 flex gap-3">
            <button
              type="submit"
              disabled={create.isPending}
              className="inline-flex h-11 items-center rounded-[10px] px-5 text-[0.82rem] font-bold text-white disabled:opacity-50"
              style={{ background: GREEN }}
              onMouseEnter={(e) => !create.isPending && (e.currentTarget.style.background = GREEN_DARK)}
              onMouseLeave={(e) => (e.currentTarget.style.background = GREEN)}
            >
              {create.isPending ? "Saving…" : "Create Customer"}
            </button>
            <Link
              href="/customers"
              className="inline-flex h-11 items-center rounded-[10px] border px-5 text-[0.82rem] font-bold"
              style={{ borderColor: LINE, color: TEXT }}
            >
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
