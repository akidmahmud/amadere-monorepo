"use client";

import { useState } from "react";
import { Button, Input, Select } from "@amader/ui";
import { BD_DISTRICTS_BY_DIVISION, BD_DIVISIONS } from "@amader/shared";
import { useAddresses, useCreateAddress, useDeleteAddress, useUpdateAddress } from "@/hooks/useAccount";
import type { components } from "@/lib/api/schema";

type AddressDto = components["schemas"]["AddressDto"];

const BLANK = {
  label: "",
  recipientName: "",
  phone: "",
  division: "",
  district: "",
  area: "",
  landmark: "",
  addressLine: "",
  postCode: "",
  isDefault: false,
};

function AddressFormFields({
  value,
  onChange,
}: {
  value: typeof BLANK;
  onChange: (next: typeof BLANK) => void;
}) {
  const districtOptions = (BD_DISTRICTS_BY_DIVISION[value.division] ?? []).map((d) => ({ value: d, label: d }));

  return (
    <div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Input placeholder="Label (Home, Office)" value={value.label} onChange={(e) => onChange({ ...value, label: e.target.value })} />
        <Input placeholder="Recipient name" value={value.recipientName} onChange={(e) => onChange({ ...value, recipientName: e.target.value })} />
      </div>
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Input placeholder="Phone" value={value.phone} onChange={(e) => onChange({ ...value, phone: e.target.value })} />
        <Input placeholder="Postcode (optional)" value={value.postCode} onChange={(e) => onChange({ ...value, postCode: e.target.value })} />
      </div>
      <Input
        className="mb-3"
        placeholder="House / building / street / area"
        value={value.addressLine}
        onChange={(e) => onChange({ ...value, addressLine: e.target.value })}
      />
      <div className="mb-3 grid grid-cols-2 gap-3">
        <Select
          options={BD_DIVISIONS.map((d) => ({ value: d, label: d }))}
          value={value.division}
          onValueChange={(division) => onChange({ ...value, division, district: "" })}
          placeholder="Division"
        />
        <Select
          options={districtOptions}
          value={value.district}
          onValueChange={(district) => onChange({ ...value, district })}
          placeholder="District"
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <Input placeholder="Thana / Area (optional)" value={value.area} onChange={(e) => onChange({ ...value, area: e.target.value })} />
        <Input placeholder="Landmark (optional)" value={value.landmark} onChange={(e) => onChange({ ...value, landmark: e.target.value })} />
      </div>
    </div>
  );
}

function AddressCard({ address }: { address: AddressDto }) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<typeof BLANK>({
    label: address.label ?? "",
    recipientName: address.recipientName,
    phone: address.phone,
    division: address.division,
    district: address.district,
    area: address.area ?? "",
    landmark: address.landmark ?? "",
    addressLine: address.addressLine,
    postCode: address.postCode ?? "",
    isDefault: address.isDefault,
  });
  const updateAddress = useUpdateAddress();
  const deleteAddress = useDeleteAddress();

  if (editing) {
    return (
      <div className="rounded-brand border border-line bg-white p-4">
        <AddressFormFields value={form} onChange={setForm} />
        <div className="mt-3 flex gap-2">
          <Button
            variant="green"
            disabled={updateAddress.isPending}
            onClick={() => updateAddress.mutate({ ...form, id: address.id }, { onSuccess: () => setEditing(false) })}
          >
            Save
          </Button>
          <Button variant="ghost" onClick={() => setEditing(false)}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-brand border border-line bg-white p-4">
      <div className="mb-1 flex items-center gap-2">
        {address.label && <span className="rounded-full bg-beige px-2 py-0.5 font-ui text-xs font-semibold text-ink">{address.label}</span>}
        {address.isDefault && <span className="rounded-full bg-green px-2 py-0.5 font-ui text-xs font-semibold text-white">Default</span>}
      </div>
      <p className="font-body text-sm text-ink">
        {address.recipientName}, {address.phone}
        <br />
        {address.addressLine}
        {address.area ? `, ${address.area}` : ""}, {address.district}, {address.division}
      </p>
      <div className="mt-3 flex gap-2">
        <Button variant="ghost" size="md" onClick={() => setEditing(true)}>
          Edit
        </Button>
        <Button variant="ghost" size="md" onClick={() => deleteAddress.mutate(address.id)}>
          Delete
        </Button>
      </div>
    </div>
  );
}

export function AddressesManager() {
  const { data: addresses, isLoading } = useAddresses();
  const createAddress = useCreateAddress();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState(BLANK);

  return (
    <div>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-ui text-[15px] font-semibold text-green">My Addresses</h2>
        {!adding && (
          <Button variant="gold" size="md" onClick={() => setAdding(true)}>
            Add New Address
          </Button>
        )}
      </div>

      {adding && (
        <div className="mb-4 rounded-brand border border-line bg-white p-4">
          <AddressFormFields value={form} onChange={setForm} />
          <div className="mt-3 flex gap-2">
            <Button
              variant="green"
              disabled={createAddress.isPending}
              onClick={() =>
                createAddress.mutate(form, {
                  onSuccess: () => {
                    setAdding(false);
                    setForm(BLANK);
                  },
                })
              }
            >
              Save Address
            </Button>
            <Button variant="ghost" onClick={() => setAdding(false)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {isLoading ? (
        <p className="font-body text-sm text-muted">Loading…</p>
      ) : !addresses || addresses.length === 0 ? (
        <p className="font-body text-sm text-muted">No saved addresses yet.</p>
      ) : (
        <div className="space-y-3">
          {addresses.map((address) => (
            <AddressCard key={address.id} address={address} />
          ))}
        </div>
      )}
    </div>
  );
}
