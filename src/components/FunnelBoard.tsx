"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Clock, CalendarClock, Inbox, ChevronDown, Filter, Phone, Tag, Plus, Search, X } from "lucide-react";
import { updateLeadStageAction, updateLeadEmailAction } from "@/lib/actions/leads";
import { planStageMeetingAction, planFollowUpCallAction } from "@/lib/actions/activities";
import { saveLeadProductsAction } from "@/lib/actions/leadProducts";
import { StageSelect } from "@/components/StageSelect";
import { Avatar } from "@/components/Avatar";
import { MeetingPlannerFields } from "@/components/MeetingPlannerFields";
import { FollowUpCallField } from "@/components/FollowUpCallField";
import {
  ProductFields,
  emptyProductsState,
  hasAnyProduct,
  buildProductsFormData,
  type ProductsState,
} from "@/components/ProductFields";
import {
  isPlanningStage,
  wantsEmailPrompt,
  isFollowUpStage,
  buildMeetingFormData,
  EMPTY_MEETING_PLANNER_VALUE,
  buildFollowUpCallFormData,
  EMPTY_FOLLOW_UP_CALL_VALUE,
  type MeetingPlannerValue,
  type FollowUpCallValue,
} from "@/lib/meetingPlanning";
import type { LeadType } from "@/generated/prisma/client";

type SubagentRecord = {
  id: string;
  name: string;
  team: { name: string };
};

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

function isSecondaryStage(stage: BoardStage) {
  return (
    stage.isWon ||
    stage.isLost ||
    stage.key === "niet_bereikbaar" ||
    FOLLOWUP_KEYS.has(stage.key)
  );
}

type SortOption = "recent" | "stale";

/** "Nog geen contact" telt als het langst wachtend op opvolging. */
function contactPriorityTime(lead: BoardLead) {
  return lead.lastContactedAt ? lead.lastContactedAt.getTime() : -Infinity;
}

function applyLeadFilters(
  leads: BoardLead[],
  { sortBy, onlyNoContact }: { sortBy: SortOption; onlyNoContact: boolean }
) {
  const filtered = onlyNoContact
    ? leads.filter((l) => l.lastContactedAt === null)
    : leads;
  // De server levert leads al op in "meest recent toegevoegd"-volgorde.
  if (sortBy === "recent") return filtered;
  return [...filtered].sort(
    (a, b) => contactPriorityTime(a) - contactPriorityTime(b)
  );
}

type BoardLead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
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

function LeadCard({
  lead,
  stages,
  subagents,
  canCloseDeals,
  dragged,
  onDragStart,
  onDragEnd,
}: {
  lead: BoardLead;
  stages: BoardStage[];
  subagents: SubagentRecord[];
  canCloseDeals: boolean;
  dragged: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const nextContact = lead.activities[0]?.scheduledAt ?? null;
  const lastContact = formatDate(lead.lastContactedAt);
  const upcoming = formatDate(nextContact);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`cursor-grab rounded-lg border border-slate-200 bg-white p-3 shadow-sm transition hover:border-slate-300 hover:shadow-md active:cursor-grabbing ${
        dragged ? "opacity-40" : ""
      }`}
    >
      <Link
        href={`/leads/${lead.id}`}
        className="font-medium text-slate-900 hover:underline"
      >
        {lead.firstName} {lead.lastName}
      </Link>
      {lead.company && <p className="text-sm text-slate-400">{lead.company}</p>}

      <div className="mt-1.5 flex flex-col gap-1 text-sm">
        {lead.phone ? (
          <a
            href={`tel:${lead.phone}`}
            onClick={(e) => e.stopPropagation()}
            draggable={false}
            className="flex items-center gap-1.5 text-slate-600 hover:underline"
          >
            <Phone size={12} className="shrink-0 text-slate-400" />
            {lead.phone}
          </a>
        ) : (
          <span className="flex items-center gap-1.5 text-slate-300">
            <Phone size={12} className="shrink-0" />
            Geen telefoon
          </span>
        )}
        {lead.source && (
          <span className="flex items-center gap-1.5 text-slate-500">
            <Tag size={12} className="shrink-0 text-slate-400" />
            {lead.source}
          </span>
        )}
      </div>

      <div className="mt-2 flex items-center gap-1.5">
        <Avatar name={lead.owner.name} size="sm" />
        <span className="text-sm text-slate-500">{lead.owner.name}</span>
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
          leadEmail={lead.email}
          stages={stages}
          subagents={subagents}
          canCloseDeals={canCloseDeals}
        />
      </div>
    </div>
  );
}

export type PickerLead = {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string | null;
  source: string | null;
  stageId: string;
  stageLabel: string;
};

export function FunnelBoard({
  stages,
  leadType,
  subagents,
  pickerLeads,
  canCloseDeals,
}: {
  stages: BoardStage[];
  leadType: LeadType;
  subagents: SubagentRecord[];
  /** Alle leads van dit type (ook buiten dit bord, bv. nog in Pipeline), voor de "+"-zoekpopup. */
  pickerLeads: PickerLead[];
  /** Enkel subagenten (of Beheerder/Admin) mogen een lead als klant afsluiten. */
  canCloseDeals: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>("recent");
  const [onlyNoContact, setOnlyNoContact] = useState(false);
  const [draggedLeadId, setDraggedLeadId] = useState<string | null>(null);
  const [dragOverStageId, setDragOverStageId] = useState<string | null>(null);
  const [expandedStageIds, setExpandedStageIds] = useState<Set<string>>(new Set());
  const [pickerStageId, setPickerStageId] = useState<string | null>(null);
  const [pickerQuery, setPickerQuery] = useState("");
  const [pendingMove, setPendingMove] = useState<{
    leadId: string;
    leadName: string;
    leadEmail: string | null;
    fromStageLabel: string;
    toStageId: string;
    toStageLabel: string;
    toStageIsWon: boolean;
  } | null>(null);
  const [notes, setNotes] = useState("");
  const [emailInput, setEmailInput] = useState("");
  const [meeting, setMeeting] = useState<MeetingPlannerValue>(
    EMPTY_MEETING_PLANNER_VALUE
  );
  const [followUpCall, setFollowUpCall] = useState<FollowUpCallValue>(
    EMPTY_FOLLOW_UP_CALL_VALUE
  );
  const [products, setProducts] = useState<ProductsState>(emptyProductsState());

  const mainStages = stages
    .filter((s) => !isSecondaryStage(s))
    .sort((a, b) => a.order - b.order);
  const secondaryStages = stages
    .filter(isSecondaryStage)
    .sort((a, b) => a.order - b.order);

  const activeStageIds = mainStages.map((s) => s.id);

  function toggleExpanded(stageId: string) {
    setExpandedStageIds((current) => {
      const next = new Set(current);
      if (next.has(stageId)) next.delete(stageId);
      else next.add(stageId);
      return next;
    });
  }

  function startMove(lead: BoardLead, targetStage: BoardStage) {
    const fromStage = stages.find((s) => s.id === lead.stageId);
    setNotes("");
    setMeeting(EMPTY_MEETING_PLANNER_VALUE);
    setFollowUpCall(EMPTY_FOLLOW_UP_CALL_VALUE);
    setEmailInput("");
    setProducts(emptyProductsState());
    setPendingMove({
      leadId: lead.id,
      leadName: `${lead.firstName} ${lead.lastName}`,
      leadEmail: lead.email,
      fromStageLabel: fromStage?.label ?? "",
      toStageId: targetStage.id,
      toStageLabel: targetStage.label,
      toStageIsWon: targetStage.isWon,
    });
  }

  function handleDrop(targetStage: BoardStage) {
    setDragOverStageId(null);
    const leadId = draggedLeadId;
    setDraggedLeadId(null);
    if (!leadId) return;
    if (targetStage.isWon && !canCloseDeals) return;

    const lead = stages.flatMap((s) => s.leads).find((l) => l.id === leadId);
    if (!lead || lead.stageId === targetStage.id) return;

    startMove(lead, targetStage);
  }

  const pickerStage = mainStages.find((s) => s.id === pickerStageId) ?? null;
  const pickerResults = pickerStage
    ? pickerLeads
        .filter((l) => {
          const q = pickerQuery.trim().toLowerCase();
          if (!q) return true;
          return `${l.firstName} ${l.lastName}`.toLowerCase().includes(q);
        })
        .slice(0, 25)
    : [];

  function pickLead(pickerLead: PickerLead) {
    if (!pickerStage) return;
    setPickerStageId(null);
    setPickerQuery("");
    setNotes("");
    setMeeting(EMPTY_MEETING_PLANNER_VALUE);
    setFollowUpCall(EMPTY_FOLLOW_UP_CALL_VALUE);
    setEmailInput("");
    setProducts(emptyProductsState());
    setPendingMove({
      leadId: pickerLead.id,
      leadName: `${pickerLead.firstName} ${pickerLead.lastName}`,
      leadEmail: pickerLead.email,
      fromStageLabel: pickerLead.stageLabel,
      toStageId: pickerStage.id,
      toStageLabel: pickerStage.label,
      toStageIsWon: pickerStage.isWon,
    });
  }

  function confirmMove() {
    if (!pendingMove) return;
    const { leadId, toStageId, toStageIsWon } = pendingMove;
    const trimmedNotes = notes;
    const trimmedEmail = emailInput.trim();
    const meetingFormData = buildMeetingFormData(meeting);
    const followUpFormData = buildFollowUpCallFormData(followUpCall);
    startTransition(async () => {
      await updateLeadStageAction(leadId, toStageId, trimmedNotes);
      if (trimmedEmail) {
        await updateLeadEmailAction(leadId, trimmedEmail);
      }
      if (meetingFormData) {
        await planStageMeetingAction(leadId, meetingFormData);
      }
      if (followUpFormData) {
        await planFollowUpCallAction(leadId, followUpFormData);
      }
      if (toStageIsWon && hasAnyProduct(products)) {
        await saveLeadProductsAction(leadId, buildProductsFormData(products));
      }
      setPendingMove(null);
      setNotes("");
      setMeeting(EMPTY_MEETING_PLANNER_VALUE);
      setFollowUpCall(EMPTY_FOLLOW_UP_CALL_VALUE);
      setEmailInput("");
      setProducts(emptyProductsState());
      router.refresh();
    });
  }

  const filtersActive = sortBy !== "recent" || onlyNoContact;

  return (
    <div className="flex flex-col gap-6">
      <div className="relative self-start">
        <button
          type="button"
          onClick={() => setFilterOpen((v) => !v)}
          className={`flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm font-medium ${
            filtersActive
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
          }`}
        >
          <Filter size={15} />
          Filter
          {filtersActive && (
            <span className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-white text-xs font-semibold text-slate-900">
              •
            </span>
          )}
        </button>
        {filterOpen && (
          <div className="absolute left-0 top-full z-20 mt-2 w-72 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-slate-400">
              Sorteren op
            </label>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="recent">Meest recent toegevoegd</option>
              <option value="stale">Langst geen contact</option>
            </select>
            <label className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={onlyNoContact}
                onChange={(e) => setOnlyNoContact(e.target.checked)}
              />
              Enkel leads zonder contact
            </label>
            {filtersActive && (
              <button
                type="button"
                onClick={() => {
                  setSortBy("recent");
                  setOnlyNoContact(false);
                }}
                className="mt-3 text-sm text-slate-500 underline hover:text-slate-700"
              >
                Filters wissen
              </button>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        {mainStages.map((stage, stageIndex) => {
          const accent = stageAccent(stage, leadType, activeStageIds.indexOf(stage.id));
          const showPicker = stageIndex < 2;
          const isDragOver = dragOverStageId === stage.id;
          const visibleLeads = applyLeadFilters(stage.leads, { sortBy, onlyNoContact });
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
              className={`flex min-w-64 flex-1 flex-col gap-3 rounded-xl border bg-white p-3 shadow-sm transition-colors ${
                isDragOver
                  ? "border-slate-400 ring-2 ring-slate-300"
                  : "border-slate-200"
              }`}
            >
              <div
                className="flex items-center justify-between rounded-lg px-3 py-2"
                style={{ backgroundColor: accent.soft }}
              >
                <span className="text-sm font-semibold" style={{ color: accent.ink }}>
                  {stage.label}
                </span>
                <span className="flex items-center gap-1.5">
                  {showPicker && (
                    <button
                      type="button"
                      title={`Bestaande lead inplannen bij ${stage.label}`}
                      onClick={() => {
                        setPickerStageId(stage.id);
                        setPickerQuery("");
                      }}
                      className="flex h-6 w-6 items-center justify-center rounded-full bg-white/70 text-slate-600 hover:bg-white"
                    >
                      <Plus size={14} />
                    </button>
                  )}
                  <span
                    style={{ backgroundColor: accent.solid }}
                    className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-medium text-white"
                  >
                    {visibleLeads.length}
                  </span>
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {visibleLeads.map((lead) => (
                  <LeadCard
                    key={lead.id}
                    lead={lead}
                    stages={stages}
                    subagents={subagents}
                    canCloseDeals={canCloseDeals}
                    dragged={draggedLeadId === lead.id}
                    onDragStart={() => setDraggedLeadId(lead.id)}
                    onDragEnd={() => setDraggedLeadId(null)}
                  />
                ))}
                {visibleLeads.length === 0 && (
                  <div className="flex flex-col items-center gap-1.5 rounded-lg border border-dashed border-slate-200 py-6 text-slate-300">
                    <Inbox size={18} />
                    <p className="text-xs">
                      {stage.leads.length === 0
                        ? "Geen leads"
                        : "Geen leads na filter"}
                    </p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div>
        <p className="mb-2 text-xs font-medium uppercase tracking-wide text-slate-400">
          Afgerond &amp; geparkeerd
        </p>
        <div className="flex flex-wrap gap-3">
          {secondaryStages.map((stage) => {
            const accent = stageAccent(stage, leadType, -1);
            const isDragOver = dragOverStageId === stage.id;
            const isExpanded = expandedStageIds.has(stage.id);
            const visibleLeads = applyLeadFilters(stage.leads, { sortBy, onlyNoContact });
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
                className={`flex min-w-64 flex-1 flex-col gap-2 rounded-xl border bg-white p-2 shadow-sm transition-colors ${
                  isDragOver
                    ? "border-slate-400 ring-2 ring-slate-300"
                    : "border-slate-200"
                }`}
              >
                <button
                  type="button"
                  onClick={() => toggleExpanded(stage.id)}
                  className="flex w-full items-center justify-between rounded-lg px-3 py-2"
                  style={{ backgroundColor: accent.soft }}
                >
                  <span className="text-sm font-semibold" style={{ color: accent.ink }}>
                    {stage.label}
                  </span>
                  <span className="flex items-center gap-2">
                    <span
                      style={{ backgroundColor: accent.solid }}
                      className="flex h-6 min-w-6 items-center justify-center rounded-full px-1.5 text-sm font-medium text-white"
                    >
                      {visibleLeads.length}
                    </span>
                    <ChevronDown
                      size={15}
                      className={`text-slate-400 transition-transform ${
                        isExpanded ? "rotate-180" : ""
                      }`}
                    />
                  </span>
                </button>
                {isExpanded && (
                  <div className="flex flex-col gap-2.5 px-1 pb-1">
                    {visibleLeads.map((lead) => (
                      <LeadCard
                        key={lead.id}
                        lead={lead}
                        stages={stages}
                        subagents={subagents}
                        canCloseDeals={canCloseDeals}
                        dragged={draggedLeadId === lead.id}
                        onDragStart={() => setDraggedLeadId(lead.id)}
                        onDragEnd={() => setDraggedLeadId(null)}
                      />
                    ))}
                    {visibleLeads.length === 0 && (
                      <p className="px-1 py-2 text-center text-xs text-slate-300">
                        {stage.leads.length === 0
                          ? "Geen leads"
                          : "Geen leads na filter"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {pickerStage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="flex max-h-[80vh] w-full max-w-md flex-col rounded-lg bg-white p-6 shadow-xl">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-lg font-medium text-slate-900">
                Lead inplannen bij &quot;{pickerStage.label}&quot;
              </h2>
              <button
                type="button"
                onClick={() => {
                  setPickerStageId(null);
                  setPickerQuery("");
                }}
                className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                <X size={18} />
              </button>
            </div>
            <div className="relative mb-3">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
              />
              <input
                autoFocus
                type="search"
                value={pickerQuery}
                onChange={(e) => setPickerQuery(e.target.value)}
                placeholder="Zoek op naam…"
                className="w-full rounded-md border border-slate-300 py-2 pl-9 pr-3 text-sm"
              />
            </div>
            <div className="flex flex-col gap-1 overflow-y-auto">
              {pickerResults.map((lead) => (
                <button
                  key={lead.id}
                  type="button"
                  onClick={() => pickLead(lead)}
                  className="flex flex-col items-start gap-0.5 rounded-md px-3 py-2 text-left hover:bg-slate-50"
                >
                  <span className="font-medium text-slate-900">
                    {lead.firstName} {lead.lastName}
                  </span>
                  <span className="flex flex-wrap gap-x-3 text-xs text-slate-500">
                    <span>{lead.phone || "Geen telefoon"}</span>
                    {lead.source && <span>Aanbevolen door: {lead.source}</span>}
                  </span>
                </button>
              ))}
              {pickerResults.length === 0 && (
                <p className="px-3 py-6 text-center text-sm text-slate-400">
                  Geen leads gevonden.
                </p>
              )}
            </div>
          </div>
        </div>
      )}

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
              className="mb-3 w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
            />
            {wantsEmailPrompt(pendingMove.toStageLabel) &&
              !pendingMove.leadEmail && (
                <div className="mb-4 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <label className="mb-1 block text-sm text-amber-800">
                    Deze lead heeft nog geen e-mailadres. Voeg er één toe zodat
                    we later kunnen uitnodigen voor afspraken (optioneel).
                  </label>
                  <input
                    type="email"
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="naam@voorbeeld.be"
                    className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
                  />
                </div>
              )}
            {isPlanningStage(pendingMove.toStageLabel) && (
              <div className="mb-4">
                <MeetingPlannerFields
                  value={meeting}
                  onChange={setMeeting}
                  meetingType={pendingMove.toStageLabel}
                  subagents={subagents.map((s) => ({
                    id: s.id,
                    name: s.name,
                    teamName: s.team.name,
                  }))}
                />
              </div>
            )}
            {isFollowUpStage(pendingMove.toStageLabel) && (
              <div className="mb-4">
                <FollowUpCallField value={followUpCall} onChange={setFollowUpCall} />
              </div>
            )}
            {pendingMove.toStageIsWon && (
              <div className="mb-4">
                <ProductFields value={products} onChange={setProducts} />
              </div>
            )}
            <div className="flex justify-end gap-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => {
                  setPendingMove(null);
                  setNotes("");
                  setMeeting(EMPTY_MEETING_PLANNER_VALUE);
                  setFollowUpCall(EMPTY_FOLLOW_UP_CALL_VALUE);
                  setEmailInput("");
                  setProducts(emptyProductsState());
                }}
                className="rounded-md border border-slate-300 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50"
              >
                Annuleren
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={confirmMove}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60"
              >
                Bevestigen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
