"use client";

import { createContext, useContext, useState } from "react";
import { Pencil, Check } from "lucide-react";
import { InlineTextField } from "@/components/InlineTextField";

const PolicyDateEditContext = createContext(false);

/**
 * Omhult de polissentabel(len): standaard tonen de polisdatums platte tekst
 * (zoals vóór ze bewerkbaar werden — oogde rustiger dan een rij vol
 * datumvelden), met deze knop om tijdelijk over te schakelen naar een
 * bewerkbare weergave voor alle tabellen tegelijk.
 */
export function PolicyDateEditToggle({ children }: { children: React.ReactNode }) {
  const [editMode, setEditMode] = useState(false);
  return (
    <PolicyDateEditContext.Provider value={editMode}>
      <div className="flex flex-col gap-3">
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setEditMode((v) => !v)}
            className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium ${
              editMode
                ? "border-slate-900 bg-slate-900 text-white"
                : "border-slate-300 text-slate-600 hover:bg-slate-50"
            }`}
          >
            {editMode ? <Check size={15} /> : <Pencil size={15} />}
            {editMode ? "Klaar met datums wijzigen" : "Datums wijzigen"}
          </button>
        </div>
        {children}
      </div>
    </PolicyDateEditContext.Provider>
  );
}

function formatDate(date: Date | null) {
  if (!date) return "—";
  return date.toLocaleDateString("nl-BE", {
    dateStyle: "medium",
    timeZone: "Europe/Brussels",
  });
}

function toDateInputValue(date: Date | null) {
  if (!date) return "";
  return date.toISOString().slice(0, 10);
}

export function PolicyDateCell({
  action,
  name,
  date,
}: {
  action: (formData: FormData) => void | Promise<void>;
  name: string;
  date: Date | null;
}) {
  const editMode = useContext(PolicyDateEditContext);
  if (!editMode) {
    return <span className="whitespace-nowrap px-1 text-slate-600">{formatDate(date)}</span>;
  }
  return (
    <InlineTextField
      type="date"
      action={action}
      name={name}
      value={toDateInputValue(date)}
      className="rounded-md border border-slate-300 px-2 py-1.5 text-sm"
    />
  );
}
