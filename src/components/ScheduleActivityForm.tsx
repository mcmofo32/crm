"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scheduleActivityAction } from "@/lib/actions/activities";
import { MeetingPlannerFields } from "@/components/MeetingPlannerFields";
import { ACTIVITY_SUBJECT_SUGGESTIONS } from "@/lib/activitySubjects";
import {
  isRichMeetingType,
  buildMeetingFormData,
  EMPTY_MEETING_PLANNER_VALUE,
  type MeetingPlannerValue,
} from "@/lib/meetingPlanning";

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  CALL: "Telefoongesprek",
  MEETING: "Afspraak",
  EMAIL: "E-mail",
  NOTE: "Notitie",
};

const CUSTOM_SUBJECT = "__custom__";

type AssignableUser = { id: string; name: string; googleCalendarConnected: boolean };
type SubagentRecord = { id: string; name: string; team: { name: string } };

/**
 * "Volgend gesprek inplannen" op de leadpagina. Voor "Financiële analyse" en
 * "Adviesgesprek" schakelt dit over naar dezelfde rijke planning als bij een
 * stage-move (vast onderwerpformaat, fysiek/online, Zoom/Meet, subagent, zelf
 * in te vullen einduur); voor andere onderwerpen blijft het eenvoudige
 * duurtijd-dropdown behouden.
 */
export function ScheduleActivityForm({
  leadId,
  assignableUsers,
  currentUserId,
  subagents,
}: {
  leadId: string;
  assignableUsers: AssignableUser[];
  currentUserId: string;
  subagents: SubagentRecord[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [type, setType] = useState("CALL");
  const [assigneeId, setAssigneeId] = useState(currentUserId);
  const [subjectPreset, setSubjectPreset] = useState(ACTIVITY_TYPE_LABELS.CALL);
  const [customSubject, setCustomSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");
  const [durationMinutes, setDurationMinutes] = useState("15");
  const [meeting, setMeeting] = useState<MeetingPlannerValue>(
    EMPTY_MEETING_PLANNER_VALUE
  );

  const subject = subjectPreset === CUSTOM_SUBJECT ? customSubject : subjectPreset;
  const richMeeting = isRichMeetingType(subject);

  // Het onderwerp volgt automatisch het gekozen type (Telefoongesprek/
  // Afspraak/E-mail/Notitie) — zo krijgt elke activiteit een agendatitel die
  // overeenkomt met wat het effectief is i.p.v. dat alles er hetzelfde
  // uitziet. Koos je zelf al een specifiek onderwerp (bv.
  // "Opvolgingsgesprek"), dan blijft die keuze behouden ook als je nadien
  // nog van type wisselt.
  function handleTypeChange(nextType: string) {
    setType(nextType);
    if (Object.values(ACTIVITY_TYPE_LABELS).includes(subjectPreset)) {
      setSubjectPreset(ACTIVITY_TYPE_LABELS[nextType]);
    }
  }

  function reset() {
    setSubjectPreset(ACTIVITY_TYPE_LABELS[type]);
    setCustomSubject("");
    setNotes("");
    setScheduledAt("");
    setDurationMinutes("15");
    setMeeting(EMPTY_MEETING_PLANNER_VALUE);
  }

  function submit() {
    let formData: FormData;
    if (richMeeting) {
      const built = buildMeetingFormData(meeting);
      if (!built) return;
      formData = built;
    } else {
      formData = new FormData();
      formData.set("scheduledAt", scheduledAt);
      formData.set("durationMinutes", durationMinutes);
      formData.set("type", type);
    }
    formData.set("leadId", leadId);
    formData.set("assigneeId", assigneeId);
    formData.set("subject", subject);
    formData.set("notes", notes);

    startTransition(async () => {
      await scheduleActivityAction(formData);
      reset();
      router.refresh();
    });
  }

  const canSubmit = (richMeeting ? Boolean(meeting.scheduledAt) : Boolean(scheduledAt)) &&
    subject.trim().length > 0;

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h2 className="mb-3 text-sm font-medium text-slate-900">
        Volgend gesprek inplannen
      </h2>
      <div className="grid grid-cols-2 gap-3 text-sm">
        {!richMeeting && (
          <select
            value={type}
            onChange={(e) => handleTypeChange(e.target.value)}
            className="rounded-md border border-slate-300 px-3 py-2"
          >
            {Object.entries(ACTIVITY_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        )}

        <select
          value={assigneeId}
          onChange={(e) => setAssigneeId(e.target.value)}
          className={`rounded-md border border-slate-300 px-3 py-2 ${
            richMeeting ? "col-span-2" : ""
          }`}
        >
          {assignableUsers.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
              {u.googleCalendarConnected ? " (agenda gekoppeld)" : ""}
            </option>
          ))}
        </select>

        <select
          value={subjectPreset}
          onChange={(e) => setSubjectPreset(e.target.value)}
          className="col-span-2 rounded-md border border-slate-300 px-3 py-2"
        >
          {ACTIVITY_SUBJECT_SUGGESTIONS.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
          <option value={CUSTOM_SUBJECT}>Andere (zelf ingeven)…</option>
        </select>
        {subjectPreset === CUSTOM_SUBJECT && (
          <input
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
            placeholder="Onderwerp"
            required
            className="col-span-2 rounded-md border border-slate-300 px-3 py-2"
          />
        )}

        {richMeeting ? (
          <div className="col-span-2">
            <MeetingPlannerFields
              value={meeting}
              onChange={setMeeting}
              meetingType={subject}
              subagents={subagents.map((s) => ({
                id: s.id,
                name: s.name,
                teamName: s.team.name,
              }))}
            />
          </div>
        ) : (
          <>
            <input
              type="datetime-local"
              value={scheduledAt}
              onChange={(e) => setScheduledAt(e.target.value)}
              required
              className="rounded-md border border-slate-300 px-3 py-2"
            />
            <select
              value={durationMinutes}
              onChange={(e) => setDurationMinutes(e.target.value)}
              className="rounded-md border border-slate-300 px-3 py-2"
            >
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="45">45 min</option>
              <option value="60">60 min</option>
            </select>
          </>
        )}

        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Notities"
          rows={2}
          className="col-span-2 rounded-md border border-slate-300 px-3 py-2"
        />

        <button
          type="button"
          disabled={pending || !canSubmit}
          onClick={submit}
          className="col-span-2 mt-1 self-start rounded-md bg-slate-900 px-4 py-2 font-medium text-white hover:bg-slate-800 disabled:opacity-60"
        >
          Inplannen
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        Wanneer de toegewezen gebruiker zijn Google Agenda gekoppeld heeft (zie
        Instellingen), wordt dit automatisch als agenda-item aangemaakt.
      </p>
    </div>
  );
}
