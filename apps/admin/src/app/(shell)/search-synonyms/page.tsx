"use client";

import { useState } from "react";
import { Button, Card } from "@amader/admin-ui";
import {
  useCreateSynonymGroup,
  useDeleteSynonymGroup,
  useSynonymGroups,
  useUpdateSynonymGroup,
  type SynonymTerm,
} from "@/hooks/useSynonyms";

function TermsEditor({
  terms,
  onChange,
}: {
  terms: SynonymTerm[];
  onChange: (terms: SynonymTerm[]) => void;
}) {
  function update(i: number, patch: Partial<SynonymTerm>) {
    onChange(terms.map((t, j) => (j === i ? { ...t, ...patch } : t)));
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {terms.map((term, i) => (
        <span key={i} className="flex items-center gap-1 rounded-pill border border-border bg-surface-2 px-2 py-1">
          <select
            value={term.locale}
            onChange={(e) => update(i, { locale: e.target.value as "EN" | "BN" })}
            className="bg-transparent text-xs text-secondary outline-none"
          >
            <option value="EN">EN</option>
            <option value="BN">BN</option>
          </select>
          <input
            value={term.term}
            onChange={(e) => update(i, { term: e.target.value })}
            className="w-24 bg-transparent text-sm text-text outline-none"
          />
          <button type="button" onClick={() => onChange(terms.filter((_, j) => j !== i))} className="text-muted hover:text-danger">
            ×
          </button>
        </span>
      ))}
      <Button type="button" variant="link" onClick={() => onChange([...terms, { locale: "EN", term: "" }])}>
        Add term
      </Button>
    </div>
  );
}

function NewGroupForm({ onDone }: { onDone: () => void }) {
  const [terms, setTerms] = useState<SynonymTerm[]>([{ locale: "EN", term: "" }]);
  const create = useCreateSynonymGroup();

  async function handleSave() {
    await create.mutateAsync(terms.filter((t) => t.term.trim()));
    onDone();
  }

  return (
    <Card className="flex flex-col gap-3">
      <TermsEditor terms={terms} onChange={setTerms} />
      <div className="flex gap-2">
        <Button type="button" variant="primary" disabled={create.isPending} onClick={handleSave}>
          {create.isPending ? "Saving…" : "Save group"}
        </Button>
        <Button type="button" variant="ghost" onClick={onDone}>Cancel</Button>
      </div>
    </Card>
  );
}

export default function SearchSynonymsPage() {
  const { data: groups, isLoading } = useSynonymGroups();
  const [creating, setCreating] = useState(false);

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-sm text-secondary">
          {groups?.length ?? 0} synonym groups — e.g. &quot;Chatu&quot; / &quot;Sattu&quot; / &quot;ছাতু&quot; treated
          as interchangeable in search.
        </p>
        {!creating && <Button variant="primary" onClick={() => setCreating(true)}>Add group</Button>}
      </div>

      {creating && <NewGroupForm onDone={() => setCreating(false)} />}
      {isLoading && <p className="text-sm text-muted">Loading…</p>}
      {groups && groups.length === 0 && !creating && <p className="text-sm text-muted">No synonym groups yet.</p>}

      <div className="flex flex-col gap-3">
        {groups?.map((group) => (
          <SynonymGroupRow key={group.id} id={group.id} terms={group.terms} />
        ))}
      </div>
    </>
  );
}

function SynonymGroupRow({ id, terms: initialTerms }: { id: number; terms: SynonymTerm[] }) {
  const [terms, setTerms] = useState(initialTerms);
  const [dirty, setDirty] = useState(false);
  const update = useUpdateSynonymGroup(id);
  const deleteGroup = useDeleteSynonymGroup();

  return (
    <Card className="flex flex-col gap-3">
      <TermsEditor
        terms={terms}
        onChange={(t) => {
          setTerms(t);
          setDirty(true);
        }}
      />
      <div className="flex gap-2">
        {dirty && (
          <Button
            type="button"
            variant="ghost"
            disabled={update.isPending}
            onClick={() => update.mutate(terms.filter((t) => t.term.trim()), { onSuccess: () => setDirty(false) })}
          >
            {update.isPending ? "Saving…" : "Save changes"}
          </Button>
        )}
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            if (confirm("Delete this synonym group?")) deleteGroup.mutate(id);
          }}
        >
          Delete group
        </Button>
      </div>
    </Card>
  );
}
