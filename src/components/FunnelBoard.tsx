"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { updateLeadStageAction } from "@/lib/actions/leads";
import { StageSelect } from "@/components/StageSelect";
import { Avatar } from "@/components/Avatar";

const PROGRESS_COLORS = ["#2563eb", "#4f46e5", "#7c3aed", "#a21caf", "#c026d3"];

function stageAccentColor(stage: {
  isWon: boolean;
  isLost: boolean;
  order: number;
}) {
  if (stage.isWon) return "#16a34a";
  if (stage.isLost) return "#dc2626";
  return PROGRESS_COLORS[stage.order % PROGRESS_COLORS.length];
}

type BoardLead = {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  stageId: string;
  owner: { name: string };
};

type BoardStage = {
  id: string;
  label: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
  leads: BoardLead[];
};

export function FunnelBoard({ stages }: { stages: BoardStage[] }) {
  const [pending, startTransition] = useTransition();
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [pendingMove, setPendingMove] = useState<{
    leadId: string;
    leadName: string;
    fromStageLabel: string;
    toStageId: string;
    toStageLabel: string;
  } | null>(null);
  const [notes, setNotes] = useState("");

  function handleDrop(targetStage: BoardStage) {
    setDragOverStageId(null);
    const leadId = draggedLeadId;
    setDraggedLeadId(null);
    if (!leadId) return;

    const lead = stages.flatMap((s) => s.leads).find((l) => l.id === leadId);
    if (!lead || lead.stageId === targetStage.id) return;

    const fromStage = stages.find((s) => s.id === lead.stageId);
    setNotes("");
    setPendingMove({
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      fromStageLabel: fromStage?.label ?? "",
      toStageId: targetStage.id,
      toStageLabel: targetStage.label,
    });
  }

  function confirmMove() {
    if (!pendingMove) return;
    const { leadId, toStageId } = pendingMove;
    const trimmedNotes = notes;
    startTransition(async () => {
      await updateLeadStageAction(leadId, toStageId, trimmedNotes);
      setPendingMove(null);
      setNotes("");
    });
  }

  return (
    <>
      <div className="flex gap-5 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const accent = stageAccentColor(stage);
          const isDragOver = dragOverStageId === stage.id;
          return (
            <div
              key={stage.id}
              style={{ borderTopColor: accent }}
              onDragOver={(e) => {
                e.preventDefault();
                if (dragOverStageId !== stage.id) setDragOverStageId(stage.id);
              }}
              onDragLeave={() =>
                setDragOverStageId((cur) => (cur === stage.id ? null : cur))
              }
              onDrop={(e) => {
                e.preventDefault();
                handleDrop(stage);
              }}
              className={`flex w-80 flex-shrink-0 flex-col gap-3 rounded-lg border-t-4 bg-slate-100 p-4 transition-colors ${
                isDragOver ? "bg-slate-200 ring-2 ring-slate-400" : ""
              }`}
            >
              <div className="flex items-center justify-between px-1">
                <span className="text-base font-semibold text-slate-800">
                  {stage.label}
                </span>
                <span
                  style={{ backgroundColor: accent }}
                  className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-medium text-white"
                >
                  {stage.leads.length}
                </span>
              </div>

              <div className="flex flex-col gap-3">
                {stage.leads.map((lead) => (
                  <div
                    key={lead.id}
                    draggable
                    onDragStart={() => setDraggedLeadId(lead.id)}
                    onDragEnd={() => setDraggedLeadId(null)}
                    className={`cursor-grab rounded-md border border-slate-200 bg-white p-4 text-base shadow-sm transition hover:border-slate-300 hover:shadow-md active:cursor-grabbing ${
                      draggedLeadId === lead.id ? "opacity-40" : ""
                    }`}
                  >
                    <Link
                      href={`/leads/${lead.id}`}
                      className="font-medium text-slate-900 hover:underline"
                    >
                      {lead.firstName} {lead.lastName}
                    </Link>
                    {lead.company && (
                      <p className="text-sm text-slate-400">{lead.company}</p>
                    )}
                    <div className="mb-2 mt-1 flex items-center gap-1.5">
                      <Avatar name={lead.owner.name} />
                      <span className="text-sm text-slate-500">
                        {lead.owner.name}
                      </span>
                    </div>
                    <StageSelect
                      leadId={lead.id}
                      currentStageId={lead.stageId}
                      stages={stages}
                    />
                  </div>
                ))}
                {stage.leads.length === 0 && (
                  <p className="px-1 text-sm text-slate-400">Geen leads</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {pendingMove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
            <h2 className="mb-1 text-lg font-medium text-slate-900">
              Lead verplaatsen
            </h2>
            <p className="mb-4 text-sm text-slate-500">
              <strong>{pendingMove.leadName}</strong> van &quot;
              {pendingMove.fromStageLabel}&quot; naar &quot;
              {pendingMove.toStageLabel}&quot;.
            </p>
            <label className="mb-1 block text-sm text-slate-600">
              Wat is er besproken/gebeurd?
            </label>
            <textarea
              autoFocus
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Bv. financiële analyse afgerond, klant tekent volgende week"
              className="mb-4 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setPendingMove(null);
                  setNotes("");
                }}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuleren
              </button>
              <button
                type="button"
                disabled={pending || !notes.trim()}
                onClick={confirmMove}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                Bevestigen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
