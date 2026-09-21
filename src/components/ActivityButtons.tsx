"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  cancelActivityAction,
  completeActivityAction,
  updateActivityAction,
  deleteActivityAction,
} from "@/lib/actions/activities";
import { ACTIVITY_SUBJECT_SUGGESTIONS } from "@/lib/activitySubjects";
import { FormToast } from "@/components/toast/FormToast";
import { useToastAction } from "@/components/toast/useToastAction";
import { useToast } from "@/components/toast/ToastProvider";
import { MeetingPlannerFields } from "@/components/MeetingPlannerFields";
import {
  bareMeetingType,
  buildMeetingFormData,
  type MeetingPlannerValue,
} from "@/lib/meetingPlanning";

type SubagentRecord = { id: string; name: string; team: { name: string } };

const ACTIVITY_TYPE_OPTIONS = [
  { value: "CALL", label: "Telefoongesprek" },
  { value: "MEETING", label: "Afspraak" },
  { value: "EMAIL", label: "E-mail" },
  { value: "NOTE", label: "Notitie" },
];

const CUSTOM_SUBJECT = "__custom__";

function toDatetimeLocalValue(date: Date | null) {
  if (!date) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toTimeValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function ActivityButtons({
  activityId,
  type,
  subject,
  scheduledAt,
  durationMinutes,
  status,
  canDelete,
  meetingMode,
  location,
  meetingLink,
  subagentId,
  subagents,
}: {
  activityId: string;
  type: string;
  subject: string;
  scheduledAt: Date | null;
  durationMinutes: number | null;
  status: string;
  canDelete: boolean;
  meetingMode: string | null;
  location: string | null;
  meetingLink: string | null;
  subagentId: string | null;
  subagents: SubagentRecord[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { runWithToast } = useToastAction();
  const { showToast } = useToast();
  const [mode, setMode] = useState<"idle" | "reporting" | "editing">("idle");
  const [reportNotes, setReportNotes] = useState("");
  const [wasVoicemail, setWasVoicemail] = useState(false);
  const [subjectPreset, setSubjectPreset] = useState(
    ACTIVITY_SUBJECT_SUGGESTIONS.includes(subject) ? subject : CUSTOM_SUBJECT
  );
  const [customSubject, setCustomSubject] = useState(
    ACTIVITY_SUBJECT_SUGGESTIONS.includes(subject) ? "" : subject
  );
  const isRichMeeting = meetingMode !== null;
  function buildMeetingDraft(): MeetingPlannerValue {
    return {
      scheduledAt: toDatetimeLocalValue(scheduledAt),
      endTime:
        scheduledAt && durationMinutes
          ? toTimeValue(new Date(scheduledAt.getTime() + durationMinutes * 60_000))
          : "",
      mode: meetingMode === "ONLINE" ? "ONLINE" : "ONSITE",
      location: location ?? "",
      useGoogleMeet: meetingMode === "ONLINE" && !meetingLink,
      subagentId: subagentId ?? "",
    };
  }
  const [meeting, setMeeting] = useState<MeetingPlannerValue>(buildMeetingDraft);
  const [richEditNotes, setRichEditNotes] = useState("");

  function resetMeetingDraft() {
    setMeeting(buildMeetingDraft());
    setRichEditNotes("");
  }

  const deleteButton = canDelete && (
    <button
      type="button"
      disabled={pending}
      title="Verwijderen"
      onClick={() => {
        if (
          confirm(
            "Deze afspraak definitief verwijderen? Dit kan niet ongedaan gemaakt worden."
          )
        ) {
          startTransition(() => {
            deleteActivityAction(activityId);
          });
        }
      }}
      className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:text-slate-500 dark:hover:bg-red-950"
    >
      <Trash2 size={14} />
    </button>
  );

  if (status !== "PLANNED") {
    return deleteButton ? <div className="flex items-center">{deleteButton}</div> : null;
  }

  if (mode === "reporting") {
    return (
      <div className="mt-2 flex flex-col gap-2">
        <textarea
          autoFocus
          value={reportNotes}
          onChange={(e) => setReportNotes(e.target.value)}
          placeholder="Wat is er besproken? (bv. telefoongesprek gehad over ..., klant wil ..., volgende stap is ...)"
          rows={2}
          className="rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        {type === "CALL" && (
          <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
            <input
              type="checkbox"
              checked={wasVoicemail}
              onChange={(e) => setWasVoicemail(e.target.checked)}
            />
            Voicemail (niet bereikt)
          </label>
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                await runWithToast(
                  () => completeActivityAction(activityId, reportNotes, wasVoicemail),
                  "Afgerond"
                );
                setMode("idle");
              })
            }
            className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Bevestigen
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode("idle")}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Annuleren
          </button>
        </div>
      </div>
    );
  }

  if (mode === "editing" && isRichMeeting) {
    return (
      <div className="mt-2 w-[30rem] max-w-full">
        <MeetingPlannerFields
          value={meeting}
          onChange={setMeeting}
          meetingType={bareMeetingType(subject)}
          subagents={subagents.map((s) => ({
            id: s.id,
            name: s.name,
            teamName: s.team.name,
          }))}
        />
        <textarea
          value={richEditNotes}
          onChange={(e) => setRichEditNotes(e.target.value)}
          rows={2}
          placeholder="Reden van wijziging (optioneel)"
          className="mt-2 w-full rounded-md border border-slate-300 px-2 py-1 text-xs dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <div className="mt-2 flex gap-2">
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
              if (richEditNotes.trim()) {
                meetingFormData.set("notes", richEditNotes.trim());
              }
              startTransition(async () => {
                await runWithToast(async () => {
                  const result = await updateActivityAction(activityId, meetingFormData);
                  if (result?.error) throw new Error(result.error);
                }, "Afspraak opgeslagen");
                setMode("idle");
                router.refresh();
              });
            }}
            className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Opslaan
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode("idle")}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Sluiten
          </button>
        </div>
      </div>
    );
  }

  if (mode === "editing") {
    return (
      <form
        action={(formData) =>
          startTransition(async () => {
            await updateActivityAction(activityId, formData);
            setMode("idle");
          })
        }
        className="mt-2 grid w-64 grid-cols-2 gap-2 text-xs"
      >
        <FormToast message="Afspraak opgeslagen" />
        <select
          name="type"
          defaultValue={type}
          className="col-span-2 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {ACTIVITY_TYPE_OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <select
          value={subjectPreset}
          onChange={(e) => setSubjectPreset(e.target.value)}
          className="col-span-2 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          {ACTIVITY_SUBJECT_SUGGESTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value={CUSTOM_SUBJECT}>Andere (zelf ingeven)…</option>
        </select>
        {subjectPreset === CUSTOM_SUBJECT ? (
          <input
            name="subject"
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
            required
            className="col-span-2 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
          />
        ) : (
          <input type="hidden" name="subject" value={subjectPreset} />
        )}
        <input
          type="datetime-local"
          name="scheduledAt"
          defaultValue={toDatetimeLocalValue(scheduledAt)}
          required
          className="rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <select
          name="durationMinutes"
          defaultValue={String(durationMinutes ?? 15)}
          className="rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        >
          <option value="15">15 min</option>
          <option value="30">30 min</option>
          <option value="45">45 min</option>
          <option value="60">60 min</option>
        </select>
        <textarea
          name="notes"
          rows={2}
          placeholder="Reden van wijziging (optioneel)"
          className="col-span-2 rounded-md border border-slate-300 px-2 py-1 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        <div className="col-span-2 flex gap-2">
          <button
            type="submit"
            disabled={pending}
            className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Opslaan
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => setMode("idle")}
            className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Sluiten
          </button>
        </div>
      </form>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          resetMeetingDraft();
          setMode("editing");
        }}
        title="Wijzigen"
        className="flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        <Pencil size={12} />
        Wijzigen
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setMode("reporting")}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
      >
        Afgerond
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(() => {
            cancelActivityAction(activityId);
          })
        }
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950"
      >
        Annuleren
      </button>
      {deleteButton}
    </div>
  );
}
