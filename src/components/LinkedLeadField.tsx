"use client";

import { useMemo, useState } from "react";
import { Search, X } from "lucide-react";

export type LinkableLead = { id: string; firstName: string; lastName: string };

/**
 * Optioneel veld bij het inplannen van een FA-afspraak om een tweede FA-lead
 * (bv. partner/koppel) te koppelen — die krijgt dan in dezelfde actie exact
 * hetzelfde tijdstip/locatie/subagent, zonder een tweede keer apart te
 * moeten inplannen (met risico op een verschillend tijdstip). Beide blijven
 * volledig aparte leads met eigen productie-/KPI-toewijzing; zie
 * planStageMeetingAction in activities.ts.
 *
 * Opent een eigen zoek-popup (i.p.v. een gewone <select>) — bij een paar
 * honderd/duizend leads is door een platte lijst scrollen niet bruikbaar.
 */
export function LinkedLeadField({
  value,
  onChange,
  leads,
  excludeLeadId,
}: {
  value: string;
  onChange: (value: string) => void;
  leads: LinkableLead[];
  excludeLeadId: string;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");

  const options = useMemo(
    () =>
      leads
        .filter((l) => l.id !== excludeLeadId)
        .sort((a, b) =>
          `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
        ),
    [leads, excludeLeadId]
  );

  if (options.length === 0) return null;

  const selected = value ? options.find((l) => l.id === value) ?? null : null;
  const q = query.trim().toLowerCase();
  const results = (
    q
      ? options.filter((l) => `${l.firstName} ${l.lastName}`.toLowerCase().includes(q))
      : options
  ).slice(0, 25);

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-slate-600 dark:text-slate-400">
        Koppelen met tweede FA-lead (optioneel)
      </label>
      <button
        type="button"
        onClick={() => {
          setQuery("");
          setOpen(true);
        }}
        title="Bv. partner/koppel — krijgt exact hetzelfde tijdstip, locatie en subagent, blijft een aparte lead met eigen productie."
        className="flex items-center justify-between gap-2 rounded-md border border-slate-300 bg-white px-3 py-2 text-left text-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-slate-800"
      >
        <span
          className={
            selected
              ? "text-slate-900 dark:text-slate-100"
              : "text-slate-400 dark:text-slate-500"
          }
        >
          {selected ? `${selected.firstName} ${selected.lastName}` : "— Geen —"}
        </span>
        <Search size={14} className="shrink-0 text-slate-400 dark:text-slate-500" />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/30 p-4">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg bg-white p-6 shadow-xl dark:bg-slate-900">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium text-slate-900 dark:text-slate-100">
                Tweede FA-lead koppelen
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              >
                <X size={18} />
              </button>
            </div>
            <div className="relative mb-3">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500"
              />
              <input
                autoFocus
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Zoek op naam…"
                className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto">
              <button
                type="button"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
                className="rounded-md px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800"
              >
                — Geen —
              </button>
              {results.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => {
                    onChange(lead.id);
                    setOpen(false);
                  }}
                  className="rounded-md px-3 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-50 dark:text-slate-100 dark:hover:bg-slate-800"
                >
                  {lead.firstName} {lead.lastName}
                </button>
              ))}
              {results.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-400 dark:text-slate-500">
                  Geen leads gevonden.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
