"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Trash2 } from "lucide-react";
import {
  cancelActivityAction,
  completeActivityAction,
  planFollowUpCallAction,
  updateActivityAction,
  deleteActivityAction,
} from "@/lib/actions/activities";
import { updateLeadStageAction } from "@/lib/actions/leads";
import { saveLeadProductsAction } from "@/lib/actions/leadProducts";
import { ACTIVITY_SUBJECT_SUGGESTIONS } from "@/lib/activitySubjects";
import { FormToast } from "@/components/toast/FormToast";
import { useToastAction } from "@/components/toast/useToastAction";
import { useToast } from "@/components/toast/ToastProvider";
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
  bareMeetingType,
  buildMeetingFormData,
  isFollowUpStage,
  buildFollowUpCallFormData,
  EMPTY_FOLLOW_UP_CALL_VALUE,
  type MeetingPlannerValue,
  type FollowUpCallValue,
} from "@/lib/meetingPlanning";
import { toBrusselsDatetimeLocalValue, toBrusselsTimeValue } from "@/lib/datetime";

type SubagentRecord = {
  id: string;
  name: string;
  team: { name: string };
  user: { role: string; agentType: string } | null;
};
type StageRecord = {
  id: string;
  key: string;
  label: string;
  isWon: boolean;
  isLost: boolean;
};

const ACTIVITY_TYPE_OPTIONS = [
  { value: "CALL", label: "Telefoongesprek" },
  { value: "MEETING", label: "Afspraak" },
  { value: "EMAIL", label: "E-mail" },
  { value: "NOTE", label: "Notitie" },
];

const CUSTOM_SUBJECT = "__custom__";

function toDatetimeLocalValue(date: Date | null) {
  return date ? toBrusselsDatetimeLocalValue(date) : "";
}

function outcomeButtonClass(selected: boolean) {
  return selected
    ? "rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
    : "rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800";
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
  meetingDescription,
  subagents,
  leadId,
  stages,
  currentStageId,
  mainStageKeys,
  canCloseDeals,
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
  meetingDescription: string | null;
  subagents: SubagentRecord[];
  leadId: string;
  stages: StageRecord[];
  currentStageId: string;
  /** De 3 "actieve" fase-keys van de funnel van deze lead (zie mainFunnelStageKeys) — bepaalt of het afronden van deze afspraak een verplichte uitkomstkeuze triggert. */
  mainStageKeys: string[];
  canCloseDeals: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const { runWithToast } = useToastAction();
  const { showToast } = useToast();
  const [mode, setMode] = useState<"idle" | "reporting" | "editing" | "outcome">(
    "idle"
  );
  const [reportNotes, setReportNotes] = useState("");
  const [wasVoicemail, setWasVoicemail] = useState(false);
  const [subjectPreset, setSubjectPreset] = useState(
    ACTIVITY_SUBJECT_SUGGESTIONS.includes(subject) ? subject : CUSTOM_SUBJECT
  );
  const [customSubject, setCustomSubject] = useState(
    ACTIVITY_SUBJECT_SUGGESTIONS.includes(subject) ? "" : subject
  );
  const isRichMeeting = meetingMode !== null;
  const currentStage = stages.find((s) => s.id === currentStageId);
  // Een "hoofd"-fase (Financiële analyse/Adviesgesprek/... — zie
  // mainFunnelStageKeys) vertegenwoordigt een lopend contactmoment: als zo'n
  // rijke afspraak wordt afgerond zonder de lead te verplaatsen, blijft die
  // voorgoed "actief" lijken op het funnelbord terwijl er niets meer gepland
  // staat. Vandaar de verplichte uitkomstkeuze hieronder.
  const isMainStageMeeting =
    isRichMeeting && currentStage != null && mainStageKeys.includes(currentStage.key);
  function buildMeetingDraft(): MeetingPlannerValue {
    return {
      scheduledAt: toDatetimeLocalValue(scheduledAt),
      endTime:
        scheduledAt && durationMinutes
          ? toBrusselsTimeValue(new Date(scheduledAt.getTime() + durationMinutes * 60_000))
          : "",
      mode: meetingMode === "ONLINE" ? "ONLINE" : "ONSITE",
      location: location ?? "",
      useGoogleMeet: meetingMode === "ONLINE" && !meetingLink,
      subagentId: subagentId ?? "",
      meetingDescription: meetingDescription ?? "",
    };
  }
  const [meeting, setMeeting] = useState<MeetingPlannerValue>(buildMeetingDraft);
  const [richEditNotes, setRichEditNotes] = useState("");
  const [outcomeStageId, setOutcomeStageId] = useState("");
  const [followUpCall, setFollowUpCall] = useState<FollowUpCallValue>(
    EMPTY_FOLLOW_UP_CALL_VALUE
  );
  const [products, setProducts] = useState<ProductsState>(emptyProductsState());

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
                setMode(isMainStageMeeting ? "outcome" : "idle");
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

  // Een hoofd-fase-afspraak (Financiële analyse/Adviesgesprek/...) is nu
  // afgerond: de lead mag hier niet blijven "hangen" zonder vervolgstap, dus
  // is een uitkomst verplicht (geen annuleren/overslaan) — net als bij het
  // verplaatsen van een kaart op het funnelbord (zie StageSelect).
  if (mode === "outcome") {
    const wonStage = stages.find((s) => s.isWon);
    const lostStage = stages.find((s) => s.isLost);
    const followUpStage = stages.find((s) => isFollowUpStage(s.label));
    const outcomeStage = stages.find((s) => s.id === outcomeStageId);

    return (
      <div className="mt-2 flex w-72 max-w-full flex-col gap-2 rounded-md border border-slate-300 bg-slate-50 p-2 text-sm dark:border-slate-700 dark:bg-slate-800/60">
        <p className="text-xs text-slate-600 dark:text-slate-400">
          Deze afspraak is afgerond. Wat is de uitkomst?
        </p>
        <div className="flex flex-wrap gap-1.5">
          {canCloseDeals && wonStage && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setOutcomeStageId(wonStage.id)}
              className={outcomeButtonClass(outcomeStageId === wonStage.id)}
            >
              Klant
            </button>
          )}
          {lostStage && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setOutcomeStageId(lostStage.id)}
              className={outcomeButtonClass(outcomeStageId === lostStage.id)}
            >
              Geen klant
            </button>
          )}
          {followUpStage && (
            <button
              type="button"
              disabled={pending}
              onClick={() => setOutcomeStageId(followUpStage.id)}
              className={outcomeButtonClass(outcomeStageId === followUpStage.id)}
            >
              Opvolging
            </button>
          )}
        </div>
        {outcomeStage && isFollowUpStage(outcomeStage.label) && (
          <FollowUpCallField value={followUpCall} onChange={setFollowUpCall} />
        )}
        {outcomeStage?.isWon && (
          <ProductFields value={products} onChange={setProducts} />
        )}
        <button
          type="button"
          disabled={pending || !outcomeStageId}
          onClick={() => {
            if (!outcomeStage) return;
            const followUpFormData = buildFollowUpCallFormData(followUpCall);
            // Vooraf valideren en enkel via toast melden i.p.v. binnen
            // runWithToast te gooien — dat gooit door naar de
            // dichtstbijzijnde error-boundary (error.tsx), wat het hele
            // venster zou wegvegen voor iets dat gewoon "vul dit ene veld
            // nog in" betekent.
            if (isFollowUpStage(outcomeStage.label) && !followUpFormData) {
              showToast("Kies een datum en uur voor het terugbelmoment", "error");
              return;
            }
            startTransition(async () => {
              await runWithToast(async () => {
                if (isFollowUpStage(outcomeStage.label) && followUpFormData) {
                  const result = await planFollowUpCallAction(
                    leadId,
                    outcomeStageId,
                    followUpFormData
                  );
                  if (result && "error" in result) throw new Error(result.error);
                }
                const stageResult = await updateLeadStageAction(
                  leadId,
                  outcomeStageId,
                  reportNotes
                );
                if (stageResult?.error) throw new Error(stageResult.error);
                if (outcomeStage.isWon && hasAnyProduct(products)) {
                  await saveLeadProductsAction(leadId, buildProductsFormData(products));
                }
              }, "Opgeslagen");
              setMode("idle");
              setOutcomeStageId("");
              setFollowUpCall(EMPTY_FOLLOW_UP_CALL_VALUE);
              setProducts(emptyProductsState());
              router.refresh();
            });
          }}
          className="rounded-md bg-slate-900 px-2 py-1 text-xs font-medium text-white hover:bg-slate-800 disabled:opacity-60 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
        >
          Bevestigen
        </button>
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
            isCoach: s.user?.role === "COACH",
            qualifiesAsSubagent: s.user?.agentType === "SUBAGENT",
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
        onClick={() => {
          if (
            confirm(
              "Deze afspraak annuleren? De agenda-afspraak wordt verwijderd."
            )
          ) {
            startTransition(() => {
              cancelActivityAction(activityId);
            });
          }
        }}
        className="rounded-md border border-slate-300 px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-60 dark:border-slate-700 dark:text-red-400 dark:hover:bg-red-950"
      >
        Annuleren
      </button>
      {deleteButton}
    </div>
  );
}
