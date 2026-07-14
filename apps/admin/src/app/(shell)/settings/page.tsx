"use client";

import { useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import { useSettings, useUpsertSetting, type Setting } from "@/hooks/useSettings";

function SettingRow({ setting }: { setting: Setting }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(() => JSON.stringify(setting.value, null, 2));
  const [error, setError] = useState<string | null>(null);
  const upsert = useUpsertSetting();

  async function handleSave() {
    try {
      const value = JSON.parse(text);
      await upsert.mutateAsync({ key: setting.key, value });
      setError(null);
      setEditing(false);
    } catch {
      setError("Invalid JSON.");
    }
  }

  return (
    <Card>
      <div className="flex items-center justify-between">
        <div>
          <div className="num text-sm font-semibold text-text">{setting.key}</div>
          <div className="text-xs text-muted">Updated {new Date(setting.updatedAt).toLocaleString()}</div>
        </div>
        {!editing && (
          <Button type="button" variant="ghost" onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <div className="mt-3 flex flex-col gap-2">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={6}
            className="num rounded-sm border border-border bg-surface p-3 font-mono text-xs text-text outline-none focus:border-brand-500"
          />
          {error && <span className="text-xs text-danger">{error}</span>}
          <div className="flex gap-2">
            <Button type="button" variant="primary" disabled={upsert.isPending} onClick={handleSave}>
              {upsert.isPending ? "Saving…" : "Save"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => { setEditing(false); setText(JSON.stringify(setting.value, null, 2)); }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <pre className="num mt-2 overflow-x-auto rounded-inner bg-surface-2 p-2 font-mono text-xs text-text">
          {JSON.stringify(setting.value, null, 2)}
        </pre>
      )}
    </Card>
  );
}

function NewSettingForm({ onDone }: { onDone: () => void }) {
  const [key, setKey] = useState("");
  const [text, setText] = useState("{}");
  const [error, setError] = useState<string | null>(null);
  const upsert = useUpsertSetting();

  async function handleSave() {
    try {
      const value = JSON.parse(text);
      await upsert.mutateAsync({ key, value });
      onDone();
    } catch {
      setError("Invalid JSON.");
    }
  }

  return (
    <Card className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Key</span>
        <input value={key} onChange={(e) => setKey(e.target.value)} className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="text-xs font-semibold text-secondary">Value (JSON)</span>
        <textarea value={text} onChange={(e) => setText(e.target.value)} rows={4} className="num rounded-sm border border-border bg-surface p-3 font-mono text-xs text-text outline-none focus:border-brand-500" />
      </label>
      {error && <span className="text-xs text-danger">{error}</span>}
      <div className="flex gap-2">
        <Button type="button" variant="primary" disabled={upsert.isPending || !key} onClick={handleSave}>
          {upsert.isPending ? "Saving…" : "Save"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </Card>
  );
}

export default function SettingsPage() {
  const { data: settings, isLoading } = useSettings();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{settings?.length ?? 0} settings</p>
        {!creating && <Button variant="primary" onClick={() => setCreating(true)}>Add setting</Button>}
      </div>

      {creating && <NewSettingForm onDone={() => setCreating(false)} />}
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {settings && settings.length === 0 && !creating && <p className="text-sm text-muted">No settings yet.</p>}

      <div className="flex flex-col gap-3">
        {settings?.map((setting) => (
          <SettingRow key={setting.key} setting={setting} />
        ))}
      </div>
    </>
  );
}
