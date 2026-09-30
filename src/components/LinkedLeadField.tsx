"use client";

export type LinkableLead = { id: string; firstName: string; lastName: string };

/**
 * Optioneel veld bij het inplannen van een FA-afspraak om een tweede FA-lead
 * (bv. partner/koppel) te koppelen — die krijgt dan in dezelfde actie exact
 * hetzelfde tijdstip/locatie/subagent, zonder een tweede keer apart te
 * moeten inplannen (met risico op een verschillend tijdstip). Beide blijven
 * volledig aparte leads met eigen productie-/KPI-toewijzing; zie
 * planStageMeetingAction in activities.ts.
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
  const options = leads
    .filter((l) => l.id !== excludeLeadId)
    .sort((a, b) =>
      `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`)
    );

  if (options.length === 0) return null;

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm text-slate-600 dark:text-slate-400">
        Koppelen met tweede FA-lead (optioneel)
      </label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
      >
        <option value="">— Geen —</option>
        {options.map((l) => (
          <option key={l.id} value={l.id}>
            {l.firstName} {l.lastName}
          </option>
        ))}
      </select>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Bv. partner/koppel — krijgt exact hetzelfde tijdstip, locatie en
        subagent, blijft een aparte lead met eigen productie.
      </p>
    </div>
  );
}
