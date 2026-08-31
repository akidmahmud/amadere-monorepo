"use client";

import { useEffect, useState } from "react";
import { Button, Card, Icon } from "@amader/admin-ui";
import { MediaPicker } from "@/components/MediaPicker";
import {
  useBkashSettings,
  useTestBkashCredentials,
  useUpdateBkashSettings,
  type BkashUpdate,
} from "@/hooks/usePaymentSettings";

// A stored secret is never sent back to the browser — the API returns only
// has-it flags. So a blank field means "leave it alone", and the placeholder
// says which of the two situations you are in.
function secretPlaceholder(stored: boolean): string {
  return stored ? "•••••••• (saved — type to replace)" : "Not set";
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block font-ui text-[0.78rem] font-bold text-text">{label}</span>
      <input
        type={type}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="h-10 w-full rounded-inner border border-border bg-surface px-3 text-[0.82rem] text-text outline-none focus:border-brand-500"
      />
    </label>
  );
}

export default function PaymentMethodsSettingsPage() {
  const { data, isLoading } = useBkashSettings();
  const update = useUpdateBkashSettings();
  const test = useTestBkashCredentials();
  const [form, setForm] = useState<BkashUpdate>({});
  const [saved, setSaved] = useState(false);

  // Seeded once the config arrives; the secret fields deliberately stay empty.
  useEffect(() => {
    if (!data) return;
    setForm({
      liveMode: data.liveMode,
      methodNameEn: data.methodNameEn,
      methodNameBn: data.methodNameBn,
      descriptionEn: data.descriptionEn,
      descriptionBn: data.descriptionBn,
      logoUrl: data.logoUrl,
    });
  }, [data]);

  function set<K extends keyof BkashUpdate>(key: K, value: BkashUpdate[K]) {
    setSaved(false);
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function save(patch: BkashUpdate = {}) {
    await update.mutateAsync({ ...form, ...patch });
    // Secrets are one-way: clear them from local state after a save so the
    // next Update does not resubmit what is already stored.
    setForm((f) => ({ ...f, username: "", password: "", appKey: "", appSecretKey: "" }));
    setSaved(true);
  }

  if (isLoading || !data) {
    return <p className="p-6 text-sm text-muted">Loading…</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-ui text-lg font-bold text-text">Payment Methods</h1>
        <p className="text-xs text-muted">
          Online payment gateways. Manual methods (pay to a merchant number and submit the
          transaction ID) are configured separately under Net Profit → Payments.
        </p>
      </div>

      <Card>
        <div className="flex items-start justify-between gap-4 border-b border-border pb-4">
          <div className="flex items-start gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-inner bg-brand-50 text-brand-500">
              <Icon name="account_balance_wallet" />
            </div>
            <div>
              <div className="font-ui text-sm font-bold text-text">bKash</div>
              <p className="text-xs text-muted">Customer can buy product and pay with bKash</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-[0.7rem] font-bold ${
                data.isActive ? "bg-success/10 text-success" : "bg-surface-2 text-muted"
              }`}
            >
              {data.isActive ? "Active" : "Inactive"}
            </span>
            {!data.isConfigured && (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[0.7rem] font-bold text-amber-700">
                Credentials incomplete
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 pt-5 lg:grid-cols-2">
          {/* Left: what the merchant has to do at bKash's end. Kept because it
              is the actual prerequisite — none of the fields on the right can
              be filled in without doing this first. */}
          <div className="text-[0.8rem] text-secondary">
            <h2 className="mb-2 font-ui text-[0.85rem] font-bold text-text">
              Configuration instructions
            </h2>
            <ol className="list-decimal space-y-2 pl-4">
              <li>
                Create a bKash merchant account —{" "}
                <a
                  href="https://www.bkash.com/en/business/merchant"
                  target="_blank"
                  rel="noreferrer"
                  className="font-bold text-brand-500 hover:underline"
                >
                  bkash.com/business/merchant
                </a>
              </li>
              <li>
                After approval, sign in to the bKash merchant portal and collect your{" "}
                <b>username</b>, <b>password</b>, <b>app key</b> and <b>app secret key</b>.
              </li>
              <li>Enter them on the right, then turn on Live mode and activate.</li>
            </ol>
            <p className="mt-4 rounded-inner bg-surface-2 p-3 text-xs text-muted">
              With Live mode off, payments run against bKash&apos;s sandbox. Leave it off until you
              have tested a full checkout.
            </p>
            <p className="mt-2 rounded-inner bg-surface-2 p-3 text-xs text-muted">
              While this gateway is inactive or its credentials are incomplete, bKash at checkout
              falls back to the manual pay-to-a-merchant-number flow.
            </p>
          </div>

          {/* Right: the editable configuration. */}
          <div className="space-y-3">
            <Field
              label="Method name (English)"
              value={form.methodNameEn ?? ""}
              onChange={(v) => set("methodNameEn", v)}
            />
            <Field
              label="Method name (Bangla)"
              value={form.methodNameBn ?? ""}
              onChange={(v) => set("methodNameBn", v)}
            />
            <Field
              label="Description (English)"
              value={form.descriptionEn ?? ""}
              onChange={(v) => set("descriptionEn", v)}
            />
            <Field
              label="Description (Bangla)"
              value={form.descriptionBn ?? ""}
              onChange={(v) => set("descriptionBn", v)}
            />
            {/* The media library, not a URL box — same picker every other
                image field in the admin uses, so an uploaded logo is a real
                Media record rather than a pasted link that can rot. */}
            <MediaPicker
              label="Method logo"
              value={form.logoUrl || undefined}
              onChange={(url) => set("logoUrl", url)}
            />

            <fieldset className="rounded-inner border border-border p-3">
              <legend className="px-1 font-ui text-[0.78rem] font-bold text-text">
                bKash API credentials
              </legend>
              <div className="space-y-3">
                <Field
                  label="Username"
                  value={form.username ?? ""}
                  onChange={(v) => set("username", v)}
                  placeholder={secretPlaceholder(data.hasUsername)}
                />
                <Field
                  label="Password"
                  type="password"
                  value={form.password ?? ""}
                  onChange={(v) => set("password", v)}
                  placeholder={secretPlaceholder(data.hasPassword)}
                />
                <Field
                  label="App key"
                  value={form.appKey ?? ""}
                  onChange={(v) => set("appKey", v)}
                  placeholder={secretPlaceholder(data.hasAppKey)}
                />
                <Field
                  label="App secret key"
                  type="password"
                  value={form.appSecretKey ?? ""}
                  onChange={(v) => set("appSecretKey", v)}
                  placeholder={secretPlaceholder(data.hasAppSecretKey)}
                />
                <label className="flex items-center gap-2 text-[0.8rem] font-bold text-text">
                  <input
                    type="checkbox"
                    checked={form.liveMode ?? false}
                    onChange={(e) => set("liveMode", e.target.checked)}
                    className="h-4 w-4 accent-brand-500"
                  />
                  Live mode
                </label>
              </div>
            </fieldset>

            {test.data && (
              <p
                className={`rounded-inner p-3 text-xs font-semibold ${
                  test.data.ok ? "bg-success/10 text-success" : "bg-red-50 text-red-700"
                }`}
              >
                {test.data.environment === "live" ? "Live" : "Sandbox"}: {test.data.message}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              {saved && <span className="mr-auto text-xs font-bold text-success">Saved</span>}
              {update.isError && (
                <span className="mr-auto text-xs font-bold text-red-600">
                  {(update.error as Error).message}
                </span>
              )}
              <Button
                variant="ghost"
                disabled={test.isPending || !data.isConfigured}
                onClick={() => test.mutate()}
              >
                {test.isPending ? "Testing…" : "Test credentials"}
              </Button>
              <Button
                variant="ghost"
                disabled={update.isPending}
                onClick={() => void save({ isActive: !data.isActive })}
              >
                {data.isActive ? "Deactivate" : "Activate"}
              </Button>
              <Button variant="primary" disabled={update.isPending} onClick={() => void save()}>
                {update.isPending ? "Saving…" : "Update"}
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
