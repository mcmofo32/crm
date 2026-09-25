"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, X } from "lucide-react";
import { updateActivityAction } from "@/lib/actions/activities";
import { MeetingPlannerFields } from "@/components/MeetingPlannerFields";
import {
  bareMeetingType,
  buildMeetingFormData,
  type MeetingPlannerValue,
} from "@/lib/meetingPlanning";
import { useToastAction } from "@/components/toast/useToastAction";
import { useToast } from "@/components/toast/ToastProvider";

type SubagentOption = { id: string; name: string; teamName: string; isCoach?: boolean };

function toDatetimeLocalValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toTimeValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/**
 * Compacte "Wijzigen"-knop voor een al ingeplande rijke afspraak (Financiële
 * analyse/Adviesgesprek/...) — voor plekken zoals de Funnel-kaart, waar geen
 * ruimte is voor de volledige ActivityButtons-rij. Opent in een modal
 * dezelfde planning-widget als bij het oorspronkelijk inplannen
 * (MeetingPlannerFields), vooraf ingevuld met de huidige waarden maar
 * aanpasbaar.
 */
export function EditMeetingButton({
  activityId,
  subject,
  scheduledAt,
  durationMinutes,
  meetingMode,
  location,
  meetingLink,
  subagentId,
  meetingDescription,
  subagents,
}: {
  activityId: string;
  subject: string;
  scheduledAt: Date;
  durationMinutes: number | null;
  meetingMode: string | null;
  location: string | null;
  meetingLink: string | null;
  subagentId: string | null;
  meetingDescription: string | null;
  subagents: SubagentOption[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { runWithToast } = useToastAction();
  const { showToast } = useToast();
  function buildDraft(): MeetingPlannerValue {
    return {
      scheduledAt: toDatetimeLocalValue(scheduledAt),
      endTime: toTimeValue(
        new Date(scheduledAt.getTime() + (durationMinutes ?? 30) * 60_000)
      ),
      mode: meetingMode === "ONLINE" ? "ONLINE" : "ONSITE",
      location: location ?? "",
      useGoogleMeet: meetingMode === "ONLINE" && !meetingLink,
      subagentId: subagentId ?? "",
      meetingDescription: meetingDescription ?? "",
    };
  }
  const [open, setOpen] = useState(false);
  const [meeting, setMeeting] = useState<MeetingPlannerValue>(buildDraft);

  if (!open) {
    return (
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setMeeting(buildDraft());
          setOpen(true);
        }}
        title="Afspraak wijzigen"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-slate-300 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <Pencil size={13} />
      </button>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-4 shadow-xl dark:bg-slate-900">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-medium text-slate-900 dark:text-slate-100">Afspraak wijzigen</h2>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
          >
            <X size={16} />
          </button>
        </div>
        <MeetingPlannerFields
          value={meeting}
          onChange={setMeeting}
          meetingType={bareMeetingType(subject)}
          subagents={subagents}
        />
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => setOpen(false)}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Sluiten
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              const meetingFormData = buildMeetingFormData(meeting);
              // Vooraf valideren en enkel via toast melden i.p.v. binnen
              // runWithToast te gooien — dat gooit door naar de
              // dichtstbijzijnde error-boundary (error.tsx), wat het hele
              // venster (en alle al ingevulde velden) zou wegvegen voor iets
              // dat gewoon "vul dit ene veld nog in" betekent.
              if (!meetingFormData) {
                showToast("Kies een datum en uur voor de afspraak", "error");
                return;
              }
              startTransition(async () => {
                await runWithToast(async () => {
                  const result = await updateActivityAction(activityId, meetingFormData);
                  if (result?.error) throw new Error(result.error);
                }, "Afspraak opgeslagen");
                setOpen(false);
                router.refresh();
              });
            }}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Opslaan
          </button>
        </div>
      </div>
    </div>
  );
}
