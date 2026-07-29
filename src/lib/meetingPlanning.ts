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

/**
 * Adviesgesprekken/Financiële analyses tonen de rijke planning-widget (Van/Tot,
 * fysiek/online, subagent). Werkt zowel op een fase-naam ("Adviesgesprek
 * ingepland") als op een rechtstreeks gekozen onderwerp ("Adviesgesprek").
 */
export function isAdviesgesprekType(meetingType: string) {
  return meetingTypeFromStageLabel(meetingType).toLowerCase() === "adviesgesprek";
}

/** Bij Financiële analyse vragen we een e-mailadres als dat nog ontbreekt. */
export function isFinancieleAnalyseType(meetingType: string) {
  return (
    meetingTypeFromStageLabel(meetingType).toLowerCase() === "financiële analyse"
  );
}

/** Onderwerpen die de rijke planning-widget (Van/Tot i.p.v. duurtijd) tonen. */
export function isRichMeetingType(meetingType: string) {
  return isAdviesgesprekType(meetingType) || isFinancieleAnalyseType(meetingType);
}

/** Bouwt de afspraaknaam op in het vaste formaat "Uur - Type Voornaam Achternaam". */
export function buildMeetingSubject(
  scheduledAt: Date,
  meetingType: string,
  firstName: string,
  lastName: string
) {
  const hours = String(scheduledAt.getHours()).padStart(2, "0");
  const minutes = String(scheduledAt.getMinutes()).padStart(2, "0");
  const type = meetingTypeFromStageLabel(meetingType);
  return `${hours}:${minutes} - ${type} ${firstName} ${lastName}`;
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

/** Zet de widget-waarden om in FormData voor `planStageMeetingAction`/`scheduleActivityAction`, of null als er geen tijdstip gekozen is. */
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
