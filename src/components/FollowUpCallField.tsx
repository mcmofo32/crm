"use client";

import { PhoneCall } from "lucide-react";
import type { FollowUpCallValue } from "@/lib/meetingPlanning";

/** Terugbelmoment-widget: plant een uitgaand telefoongesprek op een gekozen datum/uur, automatisch in de Google Agenda. */
export function FollowUpCallField({
  value,
  onChange,
}: {
  value: FollowUpCallValue;
  onChange: (value: FollowUpCallValue) => void;
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-slate-200 bg-slate-50 p-3">
      <label className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-slate-400">
        <PhoneCall size={13} />
        Terugbelmoment inplannen (optioneel)
      </label>
      <input
        type="datetime-local"
        value={value.scheduledAt}
        onChange={(e) => onChange({ scheduledAt: e.target.value })}
        className="rounded-md border border-slate-300 px-3 py-2 text-sm"
      />
      <p className="text-xs text-slate-400">
        Plant een uitgaand telefoongesprek op dit moment, automatisch in de
        Google Agenda van de eigenaar.
      </p>
    </div>
  );
}
