"use client";

import { useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import {
  useAddAttributeValue,
  useAttributes,
  useCreateAttribute,
  useDeleteAttribute,
  useDeleteAttributeValue,
  type Attribute,
} from "@/hooks/useAttributes";

function NewAttributeForm({ onDone }: { onDone: () => void }) {
  const [slug, setSlug] = useState("");
  const [name, setName] = useState("");
  const create = useCreateAttribute();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await create.mutateAsync({ slug, sortOrder: 0, translations: [{ locale: "EN", name }, { locale: "BN", name }] });
    onDone();
  }

  return (
    <Card>
      <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-secondary">Slug</span>
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            className="h-10 rounded-sm border border-border bg-surface px-3 text-sm text-text outline-none focus:border-brand-500"
          />
        </label>
        <Button type="submit" variant="primary" disabled={create.isPending}>
          {create.isPending ? "Saving…" : "Add attribute"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>
          Cancel
        </Button>
      </form>
    </Card>
  );
}

function AddValueForm({ attributeId, onDone }: { attributeId: number; onDone: () => void }) {
  const [value, setValue] = useState("");
  const [colorHex, setColorHex] = useState("");
  const addValue = useAddAttributeValue(attributeId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await addValue.mutateAsync({
      colorHex: colorHex || undefined,
      sortOrder: 0,
      translations: [{ locale: "EN", value }, { locale: "BN", value }],
    });
    onDone();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-wrap items-end gap-2 rounded-inner bg-surface-2 p-2.5">
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-secondary">Value</span>
        <input
          required
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 rounded-sm border border-border bg-surface px-2 text-xs text-text outline-none focus:border-brand-500"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-[11px] font-semibold text-secondary">Color (optional)</span>
        <input
          type="color"
          value={colorHex || "#ffffff"}
          onChange={(e) => setColorHex(e.target.value)}
          className="h-8 w-10 rounded-sm border border-border bg-surface"
        />
      </label>
      <Button type="submit" variant="ghost" disabled={addValue.isPending}>
        {addValue.isPending ? "Adding…" : "Add"}
      </Button>
      <Button type="button" variant="link" onClick={onDone}>
        Cancel
      </Button>
    </form>
  );
}

function AttributeCard({ attribute }: { attribute: Attribute }) {
  const [addingValue, setAddingValue] = useState(false);
  const deleteAttribute = useDeleteAttribute();
  const deleteValue = useDeleteAttributeValue(attribute.id);
  const name = attribute.translations[0]?.name ?? attribute.slug;

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold text-text">{name}</div>
          <div className="text-xs text-muted">{attribute.slug}</div>
        </div>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (confirm(`Delete attribute "${name}" and all its values?`)) deleteAttribute.mutate(attribute.id);
          }}
        >
          Delete attribute
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        {attribute.values.map((v) => (
          <span
            key={v.id}
            className="flex items-center gap-1.5 rounded-pill border border-border bg-surface-2 px-3 py-1.5 text-xs text-text"
          >
            {v.colorHex && (
              <span className="h-3 w-3 rounded-full border border-border" style={{ background: v.colorHex }} />
            )}
            {v.translations[0]?.value}
            <button
              type="button"
              aria-label={`Remove ${v.translations[0]?.value}`}
              onClick={() => deleteValue.mutate(v.id)}
              className="text-muted hover:text-danger"
            >
              ×
            </button>
          </span>
        ))}
      </div>

      {addingValue ? (
        <AddValueForm attributeId={attribute.id} onDone={() => setAddingValue(false)} />
      ) : (
        <Button type="button" variant="link" className="self-start" onClick={() => setAddingValue(true)}>
          Add value
        </Button>
      )}
    </Card>
  );
}

export default function AttributesPage() {
  const { data: attributes, isLoading } = useAttributes();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">{attributes?.length ?? 0} attributes</p>
        {!creating && (
          <Button variant="primary" onClick={() => setCreating(true)}>
            Add attribute
          </Button>
        )}
      </div>

      {creating && <NewAttributeForm onDone={() => setCreating(false)} />}
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {attributes && attributes.length === 0 && !creating && (
        <p className="text-sm text-muted">No attributes yet — e.g. "Weight" or "Size", used for product variants.</p>
      )}

      <div className="flex flex-col gap-3">
        {attributes?.map((attribute) => (
          <AttributeCard key={attribute.id} attribute={attribute} />
        ))}
      </div>
    </>
  );
}
