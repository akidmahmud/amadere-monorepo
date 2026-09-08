"use client";

import { useMemo, useState } from "react";
import { Button, Icon, ToggleSwitch } from "@amader/admin-ui";
import { useUpsertSetting, type Setting } from "@/hooks/useSettings";

/**
 * The low-level settings store, made readable.
 *
 * This used to print all 69 rows as `JSON.stringify(value, null, 2)` in a
 * <pre>, which meant a boolean read as `true` in a code block and every
 * change went through hand-edited JSON that rejected the save on a stray
 * comma.
 *
 * Measured across the real table: 47 of 69 values are plain scalars — 20
 * numbers, 15 booleans, 12 strings — so most of this screen never needed to
 * be JSON at all. Those get a real control. The remaining 22 objects and 1
 * array genuinely are arbitrary JSON (the backend types `value` as
 * `unknown`), so they keep a JSON editor, just folded away behind
 * "Advanced" instead of being the default presentation for everything.
 *
 * These are the raw keys behind the purpose-built screens linked at the top
 * of the page. Anything with its own editor should be changed there; this is
 * the escape hatch, so it is collapsed by default and de-emphasised.
 */

type Kind = "boolean" | "number" | "string" | "json";

function kindOf(value: unknown): Kind {
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  if (typeof value === "string") return "string";
  return "json";
}

/** "net_profit.advance_payment.alwaysOnEnabled" -> "Always on enabled" */
function humanise(key: string): string {
  const last = key.split(".").pop() ?? key;
  const words = last
    .replace(/[_-]+/g, " ")
    // camelCase -> camel Case
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .trim();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** Top-level grouping. net_profit.* is 46 of 69 rows on its own, so it is
 *  split one level deeper or it would swallow the whole page. */
function groupOf(key: string): string {
  const dot = key.split(".");
  if (dot[0] === "net_profit" && dot.length > 1) return `net_profit.${dot[1]}`;
  if (dot.length > 1) return dot[0];
  return key.split("_")[0];
}

function SettingControl({ setting }: { setting: Setting }) {
  const upsert = useUpsertSetting();
  const kind = kindOf(setting.value);

  const [draft, setDraft] = useState<string>(() =>
    kind === "json" ? JSON.stringify(setting.value, null, 2) : String(setting.value ?? ""),
  );
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  function flash() {
    setSaved(true);
    setTimeout(() => setSaved(false), 1800);
  }

  async function save(value: unknown) {
    setError(null);
    try {
      await upsert.mutateAsync({ key: setting.key, value });
      flash();
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save");
    }
  }

  // A boolean is the one case worth saving on the spot — there is nothing to
  // type, so an extra Save button would only add a step.
  if (kind === "boolean") {
    return (
      <div className="flex items-center gap-3">
        {saved && <span className="text-xs font-semibold text-success">Saved</span>}
        <ToggleSwitch
          checked={Boolean(setting.value)}
          disabled={upsert.isPending}
          onChange={(checked) => void save(checked)}
        />
      </div>
    );
  }

  if (kind === "json") {
    return (
      <div className="flex flex-col items-end gap-2">
        <div className="flex items-center gap-2">
          {saved && <span className="text-xs font-semibold text-success">Saved</span>}
          <span className="rounded-full bg-surface-2 px-2 py-0.5 font-mono text-[11px] text-muted">
            {Array.isArray(setting.value)
              ? `${setting.value.length} items`
              : `${Object.keys((setting.value as object) ?? {}).length} fields`}
          </span>
          <Button type="button" variant="ghost" className="h-8" onClick={() => setOpen((v) => !v)}>
            {open ? "Close" : "Advanced"}
          </Button>
        </div>
        {open && (
          <div className="flex w-full flex-col gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={8}
              spellCheck={false}
              className="num w-full rounded-sm border border-border bg-surface p-3 font-mono text-xs text-text outline-none focus:border-brand-500"
            />
            {error && <span className="text-xs text-danger">{error}</span>}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                className="h-8"
                onClick={() => {
                  setDraft(JSON.stringify(setting.value, null, 2));
                  setError(null);
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="primary"
                className="h-8"
                disabled={upsert.isPending}
                onClick={() => {
                  try {
                    void save(JSON.parse(draft));
                  } catch {
                    setError("Not valid JSON.");
                  }
                }}
              >
                {upsert.isPending ? "Saving…" : "Save"}
              </Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  const dirty = draft !== String(setting.value ?? "");
  return (
    <div className="flex items-center gap-2">
      {saved && <span className="text-xs font-semibold text-success">Saved</span>}
      <input
        type={kind === "number" ? "number" : "text"}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        className="h-9 w-56 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
      />
      <Button
        type="button"
        variant="primary"
        className="h-9"
        disabled={!dirty || upsert.isPending}
        onClick={() => {
          if (kind === "number") {
            const n = Number(draft);
            if (!Number.isFinite(n)) {
              setError("Must be a number.");
              return;
            }
            void save(n);
          } else {
            void save(draft);
          }
        }}
      >
        Save
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

function GroupSection({
  name,
  rows,
  forceOpen,
}: {
  name: string;
  rows: Setting[];
  forceOpen: boolean;
}) {
  const [open, setOpen] = useState(false);
  const expanded = forceOpen || open;

  return (
    // A plain div rather than <Card>: admin-ui's `cn` is clsx with no
    // tailwind-merge, so Card's own `p-[22px]` survives alongside a `p-0`
    // override and wins — every group header came out ~100px tall for one
    // line of text. Same visual tokens, padding actually controllable.
    <div className="overflow-hidden rounded-card border border-border bg-surface shadow-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left hover:bg-surface-2"
      >
        <span className="flex items-center gap-2">
          <Icon
            name={expanded ? "expand_more" : "chevron_right"}
            size={18}
            className="text-muted"
          />
          <span className="font-ui text-sm font-bold text-text">{humanise(name)}</span>
        </span>
        <span className="rounded-full bg-surface-2 px-2 py-0.5 text-[11px] font-semibold text-muted">
          {rows.length}
        </span>
      </button>

      {expanded && (
        <div className="divide-y divide-border border-t border-border">
          {rows.map((s) => (
            <div
              key={s.key}
              className="flex flex-wrap items-start justify-between gap-3 px-4 py-3"
            >
              <div className="min-w-0">
                <div className="font-ui text-sm font-semibold text-text">{humanise(s.key)}</div>
                <div className="num mt-0.5 font-mono text-[11px] text-muted">{s.key}</div>
              </div>
              <SettingControl setting={s} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function RawSettingsBrowser({ settings }: { settings: Setting[] }) {
  const [q, setQ] = useState("");
  const query = q.trim().toLowerCase();

  const groups = useMemo(() => {
    const filtered = query
      ? settings.filter(
          (s) => s.key.toLowerCase().includes(query) || humanise(s.key).toLowerCase().includes(query),
        )
      : settings;
    const map = new Map<string, Setting[]>();
    for (const s of filtered) {
      const g = groupOf(s.key);
      const list = map.get(g);
      if (list) list.push(s);
      else map.set(g, [s]);
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [settings, query]);

  const shown = groups.reduce((n, [, rows]) => n + rows.length, 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="relative">
        <Icon
          name="search"
          size={18}
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search settings…"
          className="h-10 w-full rounded-sm border border-border bg-surface pl-10 pr-3 text-sm text-text outline-none focus:border-brand-500"
        />
      </div>

      {query && (
        <p className="text-xs text-muted">
          {shown} of {settings.length} settings match “{q.trim()}”
        </p>
      )}

      {groups.length === 0 && <p className="text-sm text-muted">Nothing matches that search.</p>}

      {groups.map(([name, rows]) => (
        // Searching opens every matching group — otherwise a hit stays hidden
        // behind a collapsed header and the search looks broken.
        <GroupSection key={name} name={name} rows={rows} forceOpen={Boolean(query)} />
      ))}
    </div>
  );
}
