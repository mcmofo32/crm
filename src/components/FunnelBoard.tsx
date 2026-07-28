"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Clock, CalendarClock, Inbox } from "lucide-react";
import { updateLeadStageAction } from "@/lib/actions/leads";
import { StageSelect } from "@/components/StageSelect";
import { Avatar } from "@/components/Avatar";
import type { LeadType } from "@/generated/prisma/client";

const BLUE_RAMP = ["#93c5fd", "#3b82f6", "#1d4ed8"];
const PURPLE_RAMP = ["#c4b5fd", "#8b5cf6", "#6d28d9"];
const FOLLOWUP_KEYS = new Set(["voorstel", "opvolging"]);

type Accent = { solid: string; soft: string; ink: string };

function stageAccent(
  stage: BoardStage,
  leadType: LeadType,
  activeIndex: number
): Accent {
  if (stage.isWon) return { solid: "#16a34a", soft: "#16a34a1f", ink: "#166534" };
  if (stage.isLost) return { solid: "#dc2626", soft: "#dc26261f", ink: "#991b1b" };
  if (stage.key === "niet_bereikbaar") {
    return { solid: "#64748b", soft: "#64748b1f", ink: "#475569" };
  }
  if (FOLLOWUP_KEYS.has(stage.key)) {
    return { solid: "#d97706", soft: "#d977061f", ink: "#92400e" };
  }
  const ramp = leadType === "FA" ? BLUE_RAMP : PURPLE_RAMP;
  const solid = ramp[activeIndex % ramp.length];
  return { solid, soft: `${solid}1f`, ink: "#1e293b" };
}

function formatDate(date: Date | null) {
  if (!date) return null;
  return date.toLocaleDateString("nl-BE", { day: "numeric", month: "short" });
}

type BoardLead = {
  id: string;
  firstName: string;
  lastName: string;
  company: string | null;
  stageId: string;
  lastContactedAt: Date | null;
  owner: { name: string };
  activities: { scheduledAt: Date | null }[];
};

type BoardStage = {
  id: string;
  key: string;
  label: string;
  order: number;
  isWon: boolean;
  isLost: boolean;
  leads: BoardLead[];
};

export function FunnelBoard({
  stages,
  leadType,
}: {
  stages: BoardStage[];
  leadType: LeadType;
}) {
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

  const activeStageIds = stages
    .filter(
      (s) => !s.isWon && !s.isLost && s.key !== "niet_bereikbaar" && !FOLLOWUP_KEYS.has(s.key)
    )
    .sort((a, b) => a.order - b.order)
    .map((s) => s.id);

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
      <div className="flex snap-x snap-proximity gap-4 overflow-x-auto pb-4">
        {stages.map((stage) => {
          const accent = stageAccent(stage, leadType, activeStageIds.indexOf(stage.id));
          const isDragOver = dragOverStageId === stage.id;
          return (
            <div
              key={stage.id}
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
              className={`flex w-80 flex-shrink-0 snap-start flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm transition-colors ${
                isDragOver
                  ? "border-slate-400 ring-2 ring-slate-300"
                  : "border-slate-200"
              }`}
            >
              <div
                className="flex items-center justify-between rounded-lg px-3 py-2"
                style={{ backgroundColor: accent.soft }}
              >
                <span
                  className="text-sm font-semibold"
                  style={{ color: accent.ink }}
                >
                  {stage.label}
                </span>
                <span
                  style={{ backgroundColor: accent.solid }}
                  className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-medium text-white"
                >
                  {stage.leads.length}
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {stage.leads.map((lead) => {
                  const nextContact = lead.activities[0]?.scheduledAt ?? null;
                  const lastContact = formatDate(lead.lastContactedAt);
                  const upcoming = formatDate(nextContact);
                  return (
                    <div
                      key={lead.id}
                      draggable
                      onDragStart={() => setDraggedLeadId(lead.id)}
                      onDragEnd={() => setDraggedLeadId(null)}
                      className={`cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md active:cursor-grabbing ${
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

                      <div className="mt-2 flex items-center gap-1.5">
                        <Avatar name={lead.owner.name} size="sm" />
                        <span className="text-sm text-slate-500">
                          {lead.owner.name}
                        </span>
                      </div>

                      {(lastContact || upcoming) && (
                        <div className="mt-2 flex flex-col gap-1 border-t border-slate-100 pt-2 text-xs text-slate-400">
                          {lastContact && (
                            <span className="flex items-center gap-1.5">
                              <Clock size={12} />
                              Laatste contact: {lastContact}
                            </span>
                          )}
                          {upcoming && (
                            <span className="flex items-center gap-1.5 text-amber-600">
                              <CalendarClock size={12} />
                              Volgend contact: {upcoming}
                            </span>
                          )}
                        </div>
                      )}

                      <div className="mt-2.5">
                        <StageSelect
                          leadId={lead.id}
                          currentStageId={lead.stageId}
                          stages={stages}
                        />
                      </div>
                    </div>
                  );
                })}
                {stage.leads.length === 0 && (
                  <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-slate-200 py-6 text-slate-300">
                    <Inbox size={18} />
                    <p className="text-xs">Geen leads</p>
                  </div>
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
