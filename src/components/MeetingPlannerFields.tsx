"use client";

import { Video, MapPin } from "lucide-react";
import { isAdviesgesprekType, type MeetingPlannerValue } from "@/lib/meetingPlanning";

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
    <div className="flex flex-col gap-2 rounded-md border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
        Afspraak inplannen (optioneel)
      </p>

      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Van</label>
          <input
            type="datetime-local"
            value={value.scheduledAt}
            onChange={(e) => onChange({ ...value, scheduledAt: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">Tot</label>
          <input
            type="time"
            value={value.endTime}
            onChange={(e) => onChange({ ...value, endTime: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2 text-sm">
        <button
          type="button"
          onClick={() => onChange({ ...value, mode: "ONSITE" })}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-md border px-3 py-2 ${
            value.mode === "ONSITE"
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white text-slate-600"
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
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white text-slate-600"
          }`}
        >
          <Video size={14} />
          Online
        </button>
      </div>

      {value.mode === "ONSITE" ? (
        <input
          type="text"
          value={value.location}
          onChange={(e) => onChange({ ...value, location: e.target.value })}
          placeholder="Adres van de afspraak"
          className="rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      ) : (
        <label className="flex items-center gap-2 text-sm text-slate-600">
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

      <p className="text-xs text-slate-400">
        {value.mode === "ONLINE"
          ? value.useGoogleMeet
            ? "Er wordt automatisch een Google Meet-link toegevoegd aan de agenda-afspraak."
            : "Onze vaste Zoom-link (Instellingen) wordt automatisch in de omschrijving gezet."
          : "Enkel zichtbaar als locatie op het agenda-item."}
      </p>

      {isAdviesgesprekType(meetingType) && (
        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500">
            Subagent uitnodigen (optioneel, om te closen)
          </label>
          <select
            value={value.subagentId}
            onChange={(e) => onChange({ ...value, subagentId: e.target.value })}
            className="rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">Geen subagent</option>
            {subagents.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} ({s.teamName})
              </option>
            ))}
          </select>
        </div>
      )}

      <p className="text-xs text-slate-400">
        De lead wordt automatisch als deelnemer uitgenodigd via het
        opgeslagen e-mailadres (indien gekend).
      </p>
    </div>
  );
}
