"use client";

import { useState, useTransition } from "react";
import { updateLeadStageAction } from "@/lib/actions/leads";

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
  const [selectedStageId, setSelectedStageId] = useState(currentStageId);
  const [pendingStageId, setPendingStageId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");

  const pendingStage = stages.find((s) => s.id === pendingStageId);

  if (pendingStageId && pendingStage) {
    return (
      <div className="flex w-full flex-col gap-2 rounded-md border border-slate-300 bg-slate-50 p-2 text-sm">
        <p className="text-slate-600">
          Verplaatsen naar{" "}
          <span className="font-medium text-slate-900">
            {pendingStage.label}
          </span>{" "}
          — wat is de reden/uitkomst?
        </p>
        <textarea
          autoFocus
          rows={2}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="bv. financiële analyse afgerond, klant tekent volgende week"
          className="rounded-md border border-slate-300 px-2 py-1 text-sm"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending || !notes.trim()}
            onClick={() =>
              startTransition(async () => {
                await updateLeadStageAction(leadId, pendingStageId, notes);
                setSelectedStageId(pendingStageId);
                setPendingStageId(null);
                setNotes("");
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
              setPendingStageId(null);
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
    <select
      aria-label="Funnel-fase"
      value={selectedStageId}
      disabled={pending}
      onChange={(e) => setPendingStageId(e.target.value)}
      className="rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60"
    >
      {stages.map((stage) => (
        <option key={stage.id} value={stage.id}>
          {stage.label}
        </option>
      ))}
    </select>
  );
}
