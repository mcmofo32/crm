/**
 * Fases die op "ingepland" eindigen (bv. "Financiële analyse ingepland",
 * "Adviesgesprek ingepland", "Kennismakingsgesprek ingepland", "Carrière
 * gesprek ingepland") krijgen naast de verplichte rapportering ook een
 * planning-widget om meteen een afspraak (fysiek of online) in te plannen.
 */
export function isPlanningStage(stageLabel: string) {
  return /\bingepland$/i.test(stageLabel.trim());
}

/** Haalt het "type" gesprek uit de fase-naam, bv. "Financiële analyse ingepland" -> "Financiële analyse". */
export function meetingTypeFromStageLabel(stageLabel: string) {
  return stageLabel.trim().replace(/\s+ingepland$/i, "");
}

/** Adviesgesprekken tonen de subagent-keuze in de planning-widget: zij sluiten mee af. */
export function isAdviesgesprekStage(stageLabel: string) {
  return meetingTypeFromStageLabel(stageLabel).toLowerCase() === "adviesgesprek";
}

/** Bij verplaatsen naar Financiële analyse ingepland vragen we een e-mailadres als dat nog ontbreekt. */
export function isFinancieleAnalyseStage(stageLabel: string) {
  return (
    meetingTypeFromStageLabel(stageLabel).toLowerCase() === "financiële analyse"
  );
}

/** Bouwt de afspraaknaam op in het vaste formaat "Uur - Type Voornaam Achternaam". */
export function buildMeetingSubject(
  scheduledAt: Date,
  stageLabel: string,
  firstName: string,
  lastName: string
) {
  const hours = String(scheduledAt.getHours()).padStart(2, "0");
  const minutes = String(scheduledAt.getMinutes()).padStart(2, "0");
  const meetingType = meetingTypeFromStageLabel(stageLabel);
  return `${hours}:${minutes} - ${meetingType} ${firstName} ${lastName}`;
}

export type MeetingPlannerValue = {
  scheduledAt: string;
  endTime: string;
  mode: "ONSITE" | "ONLINE";
  location: string;
  useGoogleMeet: boolean;
  subagentId: string;
};

export const EMPTY_MEETING_PLANNER_VALUE: MeetingPlannerValue = {
  scheduledAt: "",
  endTime: "",
  mode: "ONSITE",
  location: "",
  useGoogleMeet: false,
  subagentId: "",
};

/** Zet de widget-waarden om in FormData voor `planStageMeetingAction`, of null als er geen tijdstip gekozen is. */
export function buildMeetingFormData(value: MeetingPlannerValue): FormData | null {
  if (!value.scheduledAt) return null;
  const formData = new FormData();
  formData.set("scheduledAt", value.scheduledAt);
  formData.set("endTime", value.endTime);
  formData.set("mode", value.mode);
  if (value.mode === "ONSITE") formData.set("location", value.location);
  if (value.mode === "ONLINE" && value.useGoogleMeet) {
    formData.set("useGoogleMeet", "on");
  }
  if (value.subagentId) formData.set("subagentId", value.subagentId);
  return formData;
}
