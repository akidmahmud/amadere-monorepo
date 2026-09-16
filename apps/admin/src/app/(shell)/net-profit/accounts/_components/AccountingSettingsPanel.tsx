"use client";

import { useEffect, useState } from "react";
import { Button, Field, fieldInputClass } from "@amader/admin-ui";
import {
  useCodFeeSettings,
  useUpdateCodFeeSettings,
  useUpdateVatSettings,
  useVatSettings,
} from "@/hooks/useAccounts";
import { SectionCard } from "./shared";

export function AccountingSettingsPanel() {
  const { data: vat } = useVatSettings();
  const { data: cod } = useCodFeeSettings();
  const updateVat = useUpdateVatSettings();
  const updateCod = useUpdateCodFeeSettings();
  const [vatEnabled, setVatEnabled] = useState(true);
  const [vatRate, setVatRate] = useState("15");
  const [binNumber, setBinNumber] = useState("");
  const [codEnabled, setCodEnabled] = useState(false);
  const [codPercent, setCodPercent] = useState("1");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!vat) return;
    setVatEnabled(vat.enabled);
    setVatRate(String(vat.ratePercent));
    setBinNumber(vat.binNumber);
  }, [vat]);

  useEffect(() => {
    if (!cod) return;
    setCodEnabled(cod.enabled);
    setCodPercent(String(cod.percent));
  }, [cod]);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <SectionCard
        title="VAT settings"
        subtitle="Store-wide VAT defaults; product exceptions remain in the VAT Exception tab."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 py-2 text-sm text-text">
            <input
              type="checkbox"
              checked={vatEnabled}
              onChange={(e) => setVatEnabled(e.target.checked)}
            />
            VAT accounting enabled
          </label>
          <Field label="Default VAT rate (%)" required>
            <input
              type="number"
              min="0"
              step="0.01"
              value={vatRate}
              onChange={(e) => setVatRate(e.target.value)}
              className={fieldInputClass}
            />
          </Field>
          <Field label="Business BIN" className="sm:col-span-2">
            <input
              value={binNumber}
              onChange={(e) => setBinNumber(e.target.value)}
              className={fieldInputClass}
            />
          </Field>
        </div>
        <Button
          type="button"
          variant="primary"
          className="mt-4"
          disabled={updateVat.isPending || Number(vatRate) < 0}
          onClick={() => {
            setMessage(null);
            updateVat.mutate(
              {
                enabled: vatEnabled,
                ratePercent: Number(vatRate),
                binNumber: binNumber.trim(),
              },
              {
                onSuccess: () => setMessage("VAT settings saved."),
                onError: (e: unknown) =>
                  setMessage(
                    e instanceof Error
                      ? e.message
                      : "Could not save VAT settings",
                  ),
              },
            );
          }}
        >
          {updateVat.isPending ? "Saving…" : "Save VAT settings"}
        </Button>
      </SectionCard>

      <SectionCard
        title="COD fee settings"
        subtitle="Internal COD-fee accounting configuration."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex items-center gap-2 py-2 text-sm text-text">
            <input
              type="checkbox"
              checked={codEnabled}
              onChange={(e) => setCodEnabled(e.target.checked)}
            />
            COD fee enabled
          </label>
          <Field label="COD fee (%)" required>
            <input
              type="number"
              min="0"
              step="0.01"
              value={codPercent}
              onChange={(e) => setCodPercent(e.target.value)}
              className={fieldInputClass}
            />
          </Field>
        </div>
        <Button
          type="button"
          variant="primary"
          className="mt-4"
          disabled={updateCod.isPending || Number(codPercent) < 0}
          onClick={() => {
            setMessage(null);
            updateCod.mutate(
              { enabled: codEnabled, percent: Number(codPercent) },
              {
                onSuccess: () => setMessage("COD fee settings saved."),
                onError: (e: unknown) =>
                  setMessage(
                    e instanceof Error
                      ? e.message
                      : "Could not save COD settings",
                  ),
              },
            );
          }}
        >
          {updateCod.isPending ? "Saving…" : "Save COD settings"}
        </Button>
      </SectionCard>

      {message ? (
        <p className="text-sm text-secondary lg:col-span-2">{message}</p>
      ) : null}
    </div>
  );
}
