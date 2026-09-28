"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Icon } from "@amader/admin-ui";
import { useToast } from "@/components/ToastProvider";
import { proxyFetch } from "@/lib/api/proxy-client";
import { renderSmsPreview, smsParts } from "@/lib/pos-sms";
import { card, input, primaryBtn } from "./PosSubPage";

type Settings = {
  thankYouEnabled: boolean;
  thankYouMessage: string;
  websiteUrl: string;
  gateway: {
    enabled: boolean;
    senderId: string;
    hasApiKey: boolean;
    balance: number | null;
  };
};

const TAGS: [string, string][] = [
  ["name", "Customer name"],
  ["amount", "Order total"],
  ["orderNumber", "Order number"],
  ["store", "Store name"],
  ["website", "Website link"],
];

/** POS Settings › SMS: the thank-you text after a sale (shared SMS gateway). */
export function PosSmsSettingsTab() {
  const { data } = useQuery({
    queryKey: ["pos-sms-settings"],
    queryFn: () => proxyFetch<Settings>("/admin/pos/settings/sms"),
  });
  if (!data) return <div className="text-sm text-gray-500">Loading…</div>;
  return <Form initial={data} />;
}

function Form({ initial }: { initial: Settings }) {
  const toast = useToast();
  const qc = useQueryClient();
  const [v, setV] = useState({
    thankYouEnabled: initial.thankYouEnabled,
    thankYouMessage: initial.thankYouMessage,
    websiteUrl: initial.websiteUrl,
  });
  const [testPhone, setTestPhone] = useState("");
  const [cursor, setCursor] = useState<number | null>(null);
  const save = useMutation({
    mutationFn: () =>
      proxyFetch("/admin/pos/settings/sms", {
        method: "PUT",
        body: JSON.stringify(v),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pos-sms-settings"] });
      toast.push("SMS settings saved", "success");
    },
    onError: (e) => toast.push(e.message),
  });
  const test = useMutation({
    mutationFn: () =>
      proxyFetch<{ status: string }>("/admin/pos/settings/sms/test", {
        method: "POST",
        body: JSON.stringify({ phone: testPhone }),
      }),
    onSuccess: (r) =>
      toast.push(
        r.status === "SENT"
          ? "Test SMS sent"
          : "The gateway did not send it — check Net Profit › SMS › Logs",
        r.status === "SENT" ? "success" : undefined,
      ),
    onError: (e) => toast.push(e.message),
  });
  const gw = initial.gateway;
  const preview = renderSmsPreview(v.thankYouMessage, {
    name: "Karim",
    amount: "360.00",
    orderNumber: "ORD-20260929-A1B2C3",
    store: "Uttara",
    website: v.websiteUrl,
  });
  const parts = smsParts(preview);
  const insertTag = (tag: string) => {
    const at = cursor ?? v.thankYouMessage.length;
    const text = v.thankYouMessage;
    setV({
      ...v,
      thankYouMessage: `${text.slice(0, at)}{{${tag}}}${text.slice(at)}`,
    });
  };

  return (
    <div className="max-w-2xl space-y-4">
      <div
        className={`${card} flex items-start gap-4 ${gw.enabled ? "" : "border-amber-300 bg-amber-50"}`}
      >
        <span
          className={`grid h-12 w-12 shrink-0 place-items-center rounded-full ${gw.enabled ? "bg-emerald-50 text-[#1d7a46]" : "bg-amber-100 text-amber-700"}`}
        >
          <Icon name="sms" size={24} />
        </span>
        <div className="flex-1 text-sm">
          <div className="font-bold">
            SMS gateway: {gw.enabled ? "On" : "Off"}
            {gw.senderId && (
              <span className="font-normal text-gray-600">
                {" "}
                · sender {gw.senderId}
              </span>
            )}
            {gw.balance !== null && (
              <span className="font-normal text-gray-600">
                {" "}
                · balance ৳{gw.balance}
              </span>
            )}
          </div>
          <p className="text-gray-600">
            POS uses the same SMS gateway as the website. Its API key, sender ID
            and on/off switch are in Net Profit › SMS
            {gw.enabled
              ? "."
              : " — turn it on there, or no POS SMS will be sent."}
          </p>
        </div>
      </div>

      <div className={`${card} space-y-4`}>
        <label className="flex items-center justify-between gap-4">
          <span>
            <span className="font-semibold">
              Thank-you SMS after every POS sale
            </span>
            <span className="block text-xs text-gray-500">
              Sent to the customer&apos;s phone when the sale has one.
            </span>
          </span>
          <input
            type="checkbox"
            className="h-5 w-5"
            checked={v.thankYouEnabled}
            onChange={(e) => setV({ ...v, thankYouEnabled: e.target.checked })}
            aria-label="Thank-you SMS on"
          />
        </label>

        <div>
          <div className="mb-1 flex flex-wrap items-center gap-1.5 text-xs">
            <span className="font-bold text-gray-700">Insert:</span>
            {TAGS.map(([tag, label]) => (
              <button
                key={tag}
                type="button"
                onClick={() => insertTag(tag)}
                className="rounded-full bg-emerald-50 px-2.5 py-1 font-mono font-semibold text-[#1d7a46] hover:bg-emerald-100"
                title={label}
              >
                {`{{${tag}}}`}
              </button>
            ))}
          </div>
          <textarea
            value={v.thankYouMessage}
            onChange={(e) => setV({ ...v, thankYouMessage: e.target.value })}
            onSelect={(e) => setCursor(e.currentTarget.selectionStart)}
            rows={4}
            maxLength={612}
            aria-label="Thank-you message"
            className="w-full rounded-lg border border-gray-200 p-3 text-sm outline-none focus:border-[#1d7a46]"
          />
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold">
            Website link ({"{{website}}"})
          </span>
          <input
            className={input}
            value={v.websiteUrl}
            onChange={(e) => setV({ ...v, websiteUrl: e.target.value })}
            placeholder="https://amadere.com"
          />
        </label>

        <div className="rounded-xl bg-gray-50 p-3 text-sm">
          <div className="mb-1 flex items-center justify-between text-xs text-gray-500">
            <span>Preview</span>
            <span>
              {parts.chars} characters · {parts.parts} SMS
              {parts.unicode ? " (Bangla/৳: 70 per SMS)" : ""}
            </span>
          </div>
          <p className="whitespace-pre-wrap">{preview}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className={primaryBtn}
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Saving…" : "Save SMS settings"}
          </button>
          <span className="ml-auto flex items-center gap-2">
            <input
              className={`${input} w-40`}
              placeholder="01XXXXXXXXX"
              inputMode="tel"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              aria-label="Test phone"
            />
            <button
              className="h-10 rounded-lg border border-gray-200 px-3 text-sm font-semibold disabled:opacity-50"
              disabled={
                !/^01[3-9]\d{8}$/.test(testPhone) ||
                test.isPending ||
                !gw.enabled
              }
              onClick={() => test.mutate()}
              title={
                gw.enabled
                  ? "Sends the saved message with sample values"
                  : "Gateway is off"
              }
            >
              Send test
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
