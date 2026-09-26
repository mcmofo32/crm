"use client";

import { useState, useTransition } from "react";
import { Plus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateLeadStageAction, updateLeadEmailAction } from "@/lib/actions/leads";
import { planStageMeetingAction, planFollowUpCallAction } from "@/lib/actions/activities";
import { saveLeadProductsAction } from "@/lib/actions/leadProducts";
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
import { useToastAction } from "@/components/toast/useToastAction";
import { useToast } from "@/components/toast/ToastProvider";

type SubagentRecord = {
  id: string;
  name: string;
  team: { name: string };
  user: { role: string; agentType: string } | null;
};

export function StageSelect({
  leadId,
  currentStageId,
  leadEmail,
  stages,
  subagents,
  variant = "full",
  canCloseDeals = true,
}: {
  leadId: string;
  currentStageId: string;
  leadEmail: string | null;
  stages: { id: string; label: string; isWon: boolean }[];
  subagents: SubagentRecord[];
  /** "icon" toont enkel een compacte "+"-knop (bv. in een tabelrij) i.p.v. de huidige fase + "Afgerond". */
  variant?: "full" | "icon";
  /** Enkel subagenten (of Beheerder/Admin) mogen een lead als klant afsluiten — anders valt de "Klant"-fase weg uit de keuzelijst. */
  canCloseDeals?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { runWithToast } = useToastAction();
  const { showToast } = useToast();
  const [open, setOpen] = useState(false);
  const [targetStageId, setTargetStageId] = useState("");
  const [notes, setNotes] = useState("");
  const [meeting, setMeeting] = useState<MeetingPlannerValue>(
    EMPTY_MEETING_PLANNER_VALUE
  );
  const [followUpCall, setFollowUpCall] = useState<FollowUpCallValue>(
    EMPTY_FOLLOW_UP_CALL_VALUE
  );
  const [emailInput, setEmailInput] = useState("");
  const [products, setProducts] = useState<ProductsState>(emptyProductsState());

  const currentStage = stages.find((s) => s.id === currentStageId);
  const otherStages = stages.filter(
    (s) => s.id !== currentStageId && (canCloseDeals || !s.isWon)
  );
  const targetStage = stages.find((s) => s.id === targetStageId);

  if (open) {
    const formContent = (
      <div className="flex w-full flex-col gap-2 rounded-md border border-slate-300 bg-slate-50 p-2 text-sm dark:border-slate-700 dark:bg-slate-800/60">
        <label className="text-slate-600 dark:text-slate-400">
          Wat moet er met deze lead gebeuren?
        </label>
        <select
          aria-label="Volgende fase"
          value={targetStageId}
          onChange={(e) => setTargetStageId(e.target.value)}
          className="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
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
          className="rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
        />
        {targetStage && wantsEmailPrompt(targetStage.label) && !leadEmail && (
          <div className="rounded-md border border-amber-200 bg-amber-50 p-2 dark:border-amber-900 dark:bg-amber-950">
            <label className="mb-1 block text-xs text-amber-800 dark:text-amber-400">
              Nog geen e-mailadres. Voeg er één toe (optioneel):
            </label>
            <input
              type="email"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              placeholder="naam@voorbeeld.be"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        )}
        {targetStage && isPlanningStage(targetStage.label) && (
          <MeetingPlannerFields
            value={meeting}
            onChange={setMeeting}
            meetingType={targetStage.label}
            subagents={subagents.map((s) => ({
              id: s.id,
              name: s.name,
              teamName: s.team.name,
              isCoach: s.user?.role === "COACH",
              qualifiesAsSubagent: s.user?.agentType === "SUBAGENT",
            }))}
          />
        )}
        {targetStage && isFollowUpStage(targetStage.label) && (
          <FollowUpCallField value={followUpCall} onChange={setFollowUpCall} />
        )}
        {targetStage?.isWon && (
          <ProductFields value={products} onChange={setProducts} />
        )}
        <div className="flex gap-2">
          <button
            type="button"
            disabled={pending || !targetStageId}
            onClick={() => {
              const meetingFormData = buildMeetingFormData(meeting);
              const followUpFormData = buildFollowUpCallFormData(followUpCall);

              // Vooraf valideren en enkel via toast melden i.p.v. binnen
              // runWithToast te gooien — dat gooit door naar de
              // dichtstbijzijnde error-boundary (error.tsx), wat het hele
              // venster (en alle al ingevulde velden) zou wegvegen voor iets
              // dat gewoon "vul dit ene veld nog in" betekent.
              if (targetStage && isPlanningStage(targetStage.label) && !meetingFormData) {
                showToast("Kies een datum en uur voor de afspraak", "error");
                return;
              }
              if (targetStage && isFollowUpStage(targetStage.label) && !followUpFormData) {
                showToast("Kies een datum en uur voor het terugbelmoment", "error");
                return;
              }

              startTransition(async () => {
                const trimmedEmail = emailInput.trim();
                await runWithToast(async () => {
                  if (trimmedEmail) {
                    await updateLeadEmailAction(leadId, trimmedEmail);
                  }
                  // Eerst de afspraak/het terugbelmoment plannen (en dus
                  // valideren, bv. de verplichte subagent bij Adviesgesprek/
                  // Opvolggesprek) vóór de lead effectief verplaatst wordt —
                  // anders kan een lead in een "...ingepland"-fase belanden
                  // zonder dat er ooit iets ingepland werd.
                  if (targetStage && isPlanningStage(targetStage.label) && meetingFormData) {
                    const result = await planStageMeetingAction(
                      leadId,
                      targetStageId,
                      meetingFormData
                    );
                    if (result && "error" in result) throw new Error(result.error);
                  }
                  if (targetStage && isFollowUpStage(targetStage.label) && followUpFormData) {
                    const result = await planFollowUpCallAction(
                      leadId,
                      targetStageId,
                      followUpFormData
                    );
                    if (result && "error" in result) throw new Error(result.error);
                  }
                  const stageResult = await updateLeadStageAction(leadId, targetStageId, notes);
                  if (stageResult?.error) throw new Error(stageResult.error);
                  if (targetStage?.isWon && hasAnyProduct(products)) {
                    await saveLeadProductsAction(leadId, buildProductsFormData(products));
                  }
                }, "Opgeslagen");
                setOpen(false);
                setTargetStageId("");
                setNotes("");
                setMeeting(EMPTY_MEETING_PLANNER_VALUE);
                setFollowUpCall(EMPTY_FOLLOW_UP_CALL_VALUE);
                setEmailInput("");
                setProducts(emptyProductsState());
                router.refresh();
              });
            }}
            className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Bevestigen
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={() => {
              setOpen(false);
              setMeeting(EMPTY_MEETING_PLANNER_VALUE);
              setFollowUpCall(EMPTY_FOLLOW_UP_CALL_VALUE);
              setTargetStageId("");
              setNotes("");
              setEmailInput("");
              setProducts(emptyProductsState());
            }}
            className="rounded-md border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Annuleren
          </button>
        </div>
      </div>
    );

    if (variant === "icon") {
      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-md rounded-lg bg-white p-3 shadow-xl dark:bg-slate-900">
            {formContent}
          </div>
        </div>
      );
    }
    return formContent;
  }

  if (variant === "icon") {
    return (
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        title="Afspraak inplannen / fase wijzigen"
        className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-300 text-slate-500 hover:bg-slate-50 hover:text-slate-700 disabled:opacity-60 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-300"
      >
        <Plus size={16} />
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      {currentStage?.isWon ? (
        <Link
          href={`/klanten?customerId=${leadId}`}
          title="Bekijk deze klant op de Klanten-pagina"
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:underline dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {currentStage.label}
        </Link>
      ) : (
        <span className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
          {currentStage?.label}
        </span>
      )}
      <button
        type="button"
        disabled={pending}
        onClick={() => setOpen(true)}
        className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
      >
        Afgerond
      </button>
    </div>
  );
}
