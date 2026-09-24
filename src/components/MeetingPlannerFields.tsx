"use client";

import { Video, MapPin } from "lucide-react";
import {
  isAdviesgesprekType,
  isOpvolggesprekType,
  isJaarlijkseOpvolgingType,
  type MeetingPlannerValue,
} from "@/lib/meetingPlanning";
import { AddressAutocomplete } from "@/components/AddressAutocomplete";

type SubagentOption = { id: string; name: string; teamName: string };

/** Invulvelden voor de planning-widget: datum/uur, online of fysiek, adres, Zoom/Google Meet-keuze. */
export function MeetingPlannerFields({
  value,
  onChange,
  meetingType,
  subagents,
}: {
  value: MeetingPlannerValue;
  onChange: (value: MeetingPlannerValue) => void;
  meetingType: string;
  subagents: SubagentOption[];
}) {
  return (
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3 dark:border-slate-800 dark:bg-slate-800/60">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Afspraak inplannen
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 dark:text-slate-400">Van</label>
          <input
            type="datetime-local"
            value={value.scheduledAt}
            onChange={(e) => onChange({ ...value, scheduledAt: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 dark:text-slate-400">Tot</label>
          <input
            type="time"
            value={value.endTime}
            onChange={(e) => onChange({ ...value, endTime: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        </div>
      </div>

      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => onChange({ ...value, mode: "ONSITE" })}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 ${
            value.mode === "ONSITE"
              ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
              : "border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
          }`}
        >
          <MapPin size={14} />
          Fysiek
        </button>
        <button
          type="button"
          onClick={() => onChange({ ...value, mode: "ONLINE" })}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 ${
            value.mode === "ONLINE"
              ? "border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900"
              : "border-slate-300 bg-white text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400"
          }`}
        >
          <Video size={14} />
          Online
        </button>
      </div>

      {value.mode === "ONSITE" ? (
        <div className="flex flex-col gap-1">
          <AddressAutocomplete
            value={value.location}
            onChange={(location) => onChange({ ...value, location })}
            placeholder="Adres van de afspraak (leeg = kantooradres)"
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
          <p className="text-xs text-slate-400 dark:text-slate-500">
            Leeg laten gebruikt automatisch het kantooradres (zie &quot;Kantoor&quot;
            in het profielmenu).
          </p>
        </div>
      ) : (
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={value.useGoogleMeet}
            onChange={(e) =>
              onChange({ ...value, useGoogleMeet: e.target.checked })
            }
          />
          Gebruik Google Meet in plaats van onze Zoom-link
        </label>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500">
        {value.mode === "ONLINE"
          ? value.useGoogleMeet
            ? "Er wordt automatisch een Google Meet-link toegevoegd aan de agenda-afspraak."
            : "Onze vaste Zoom-link (Instellingen) wordt automatisch in de omschrijving gezet."
          : "Enkel zichtbaar als locatie op het agenda-item."}
      </p>

      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-500 dark:text-slate-400">
          Extra tekst in de omschrijving (optioneel)
        </label>
        <textarea
          value={value.meetingDescription}
          onChange={(e) =>
            onChange({ ...value, meetingDescription: e.target.value })
          }
          rows={4}
          placeholder="Bv. agenda, wat mee te brengen, praktische afspraken…"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <p className="text-xs text-slate-400 dark:text-slate-500">
          Komt mee in de omschrijving van de agenda-uitnodiging — zichtbaar
          voor iedereen die mee uitgenodigd is, dus ook de klant.
        </p>
      </div>

      {(isAdviesgesprekType(meetingType) ||
        isOpvolggesprekType(meetingType) ||
        isJaarlijkseOpvolgingType(meetingType)) && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 dark:text-slate-400">
            Subagent uitnodigen (verplicht)
          </label>
          <select
            required
            value={value.subagentId}
            onChange={(e) => onChange({ ...value, subagentId: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          >
            <option value="">Kies subagent…</option>
            {subagents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.teamName})
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="text-xs text-slate-400 dark:text-slate-500">
        De lead wordt automatisch als deelnemer uitgenodigd via het
        opgeslagen e-mailadres (indien gekend).
      </p>
    </div>
  );
}
