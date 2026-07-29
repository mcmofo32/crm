"use client";

import { useState, useTransition } from "react";
import { updateLeadStageAction } from "@/lib/actions/leads";
import { planStageMeetingAction } from "@/lib/actions/activities";
import { MeetingPlannerFields } from "@/components/MeetingPlannerFields";
import {
  isPlanningStage,
  buildMeetingFormData,
  EMPTY_MEETING_PLANNER_VALUE,
  type MeetingPlannerValue,
} from "@/lib/meetingPlanning";

export function StageSelect({
  leadId,
  currentStageId,
  stages,
}: {
  leadId: string;
  currentStageId: string;
  stages: { id: string; label: string }[];
}) {
  const [pending, startTransition] = useTransition();
  const [stageId, setStageId] = useState(currentStageId);
  const [open, setOpen] = useState(false);
  const [targetStageId, setTargetStageId] = useState("");
  const [notes, setNotes] = useState("");
  const [meeting, setMeeting] = useState<MeetingPlannerValue>(
    EMPTY_MEETING_PLANNER_VALUE
  );

  const currentStage = stages.find((s) => s.id === stageId);
  const otherStages = stages.filter((s) => s.id !== stageId);
  const targetStage = stages.find((s) => s.id === targetStageId);

  if (open) {
    return (
      <div className="flex w-full flex-col gap-2 rounded-md border border-slate-300 bg-slate-50 p-2 text-sm">
        <label className="text-slate-600">
          Wat moet er met deze lead gebeuren?
        </label>
        <select
          aria-label="Volgende fase"
          value={targetStageId}
          onChange={(e) => setTargetStageId(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        >
          <option value="">Kies fase…</option>
          {otherStages.map((stage) => (
            <option key={stage.id} value={stage.id}>
              {stage.label}
            </option>
          ))}
        </select>
        <textarea
          autoFocus
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Wat is er besproken/gebeurd? (bv. financiële analyse afgerond, klant tekent volgende week)"
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        {targetStage && isPlanningStage(targetStage.label) && (
          <MeetingPlannerFields value={meeting} onChange={setMeeting} />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending || !targetStageId || !notes.trim()}
            onClick={() =>
              startTransition(async () => {
                const meetingFormData = buildMeetingFormData(meeting);
                await updateLeadStageAction(leadId, targetStageId, notes);
                if (meetingFormData) {
                  await planStageMeetingAction(leadId, meetingFormData);
                }
                setStageId(targetStageId);
                setOpen(false);
                setTargetStageId("");
                setNotes("");
                setMeeting(EMPTY_MEETING_PLANNER_VALUE);
              })
            }
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
          >
            Bevestigen
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              setMeeting(EMPTY_MEETING_PLANNER_VALUE);
              setTargetStageId("");
              setNotes("");
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            Annuleren
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700">
        {currentStage?.label}
      </span>
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
      >
        Afgerond
      </button>
    </div>
  );
}
