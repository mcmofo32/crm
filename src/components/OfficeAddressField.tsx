"use client";

import { useState } from "react";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

/** Adresveld voor het kantooradres-formulier (server action) — bewaart lokale state zodat AddressAutocomplete controlled kan werken. */
export function OfficeAddressField({ defaultValue }: { defaultValue: string }) {
  const [value, setValue] = useState(defaultValue);
  return (
    <AddressAutocomplete
      value={value}
      onChange={setValue}
      name="address"
      placeholder="Straat, nummer, postcode, gemeente"
      className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
    />
  );
}
