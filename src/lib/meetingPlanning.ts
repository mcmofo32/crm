import { formatLocalTime } from "@/lib/datetime";

/**
 * Fases die een afspraak vertegenwoordigen — ofwel via de huidige fase-namen
 * ("Financiële analyse", "Adviesgesprek", "Kennismakingsgesprek",
 * "Carrièregesprek"), ofwel via de oudere "... ingepland"-vorm — krijgen
 * naast de verplichte rapportering ook een planning-widget om meteen een
 * afspraak (fysiek of online) in te plannen.
 */
const PLANNING_MEETING_TYPES = new Set([
  "financiële analyse",
  "adviesgesprek",
  "kennismakingsgesprek",
  "carrièregesprek",
  // Een tweede adviesgesprek in alles behalve naam — zelfde rijke widget.
  "opvolggesprek",
]);

export function isPlanningStage(stageLabel: string) {
  const trimmed = stageLabel.trim();
  const type = meetingTypeFromStageLabel(trimmed).toLowerCase();
  return PLANNING_MEETING_TYPES.has(type) || /\bingepland$/i.test(trimmed);
}

/** De "Opvolging"-fase (FA: voorstel, RG: opvolging) toont een terugbelmoment-widget. */
export function isFollowUpStage(stageLabel: string) {
  return stageLabel.trim().toLowerCase() === "opvolging";
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

/** Opvolggesprek is in alles behalve naam een tweede Adviesgesprek (zelfde widget, zelfde Van/Tot, zelfde e-mailprompt). */
export function isOpvolggesprekType(meetingType: string) {
  return meetingTypeFromStageLabel(meetingType).toLowerCase() === "opvolggesprek";
}

/**
 * Jaarlijkse opvolging: het jaarlijkse check-in-gesprek met een bestaande
 * klant (geen fase in de verkoopfunnel, dus geen "...ingepland"-fase-move,
 * i.t.t. Adviesgesprek/Opvolggesprek) — maar wel dezelfde rijke
 * planning-widget (Van/Tot, fysiek/online, subagent uitnodigen).
 */
export function isJaarlijkseOpvolgingType(meetingType: string) {
  return (
    meetingTypeFromStageLabel(meetingType).toLowerCase() === "jaarlijkse opvolging"
  );
}

/** Bij Financiële analyse vragen we een e-mailadres als dat nog ontbreekt. */
export function isFinancieleAnalyseType(meetingType: string) {
  return (
    meetingTypeFromStageLabel(meetingType).toLowerCase() === "financiële analyse"
  );
}

export function isKennismakingsgesprekType(meetingType: string) {
  return (
    meetingTypeFromStageLabel(meetingType).toLowerCase() === "kennismakingsgesprek"
  );
}

export function isCarrieregesprekType(meetingType: string) {
  return (
    meetingTypeFromStageLabel(meetingType).toLowerCase() === "carrièregesprek"
  );
}

/**
 * Fases waar we (optioneel, nooit verplicht — je wacht soms nog op het
 * e-mailadres) vragen om een e-mailadres toe te voegen als dat nog
 * ontbreekt: alle types die de lead ook effectief als deelnemer uitnodigen
 * op de afspraak (zie subjectInvitesLead) — Financiële analyse,
 * Adviesgesprek, Kennismakingsgesprek, Carrièregesprek en Opvolggesprek.
 */
export function wantsEmailPrompt(meetingType: string) {
  return (
    isFinancieleAnalyseType(meetingType) ||
    isAdviesgesprekType(meetingType) ||
    isOpvolggesprekType(meetingType) ||
    isKennismakingsgesprekType(meetingType) ||
    isCarrieregesprekType(meetingType) ||
    isJaarlijkseOpvolgingType(meetingType)
  );
}

/** Onderwerpen die de rijke planning-widget (Van/Tot i.p.v. duurtijd) tonen. */
export function isRichMeetingType(meetingType: string) {
  return (
    isAdviesgesprekType(meetingType) ||
    isFinancieleAnalyseType(meetingType) ||
    isOpvolggesprekType(meetingType) ||
    isJaarlijkseOpvolgingType(meetingType)
  );
}

/**
 * Voor welke onderwerpen wordt de lead effectief uitgenodigd (als attendee
 * met zijn e-mailadres) op het Google Agenda-item: Financiële analyse,
 * Adviesgesprek, Kennismakingsgesprek, Carrièregesprek, Belastingsaangifte
 * en Opvolggesprek — dat zijn echte afspraken mét de klant (categorie
 * "Afspraak" bij het inplannen). Een uitgaand telefoongesprek, e-mail of
 * notitie (categorie "Opvolging") is enkel een herinnering in de eigen
 * agenda van de medewerker, dus daarbij wordt de lead niet uitgenodigd.
 * Werkt op het volledige onderwerp (bv. "18:00 - Financiële analyse Jan
 * Janssens"), niet enkel op het kale type, via `contains`.
 */
export function subjectInvitesLead(subject: string) {
  const lower = subject.toLowerCase();
  return (
    lower.includes("financiële analyse") ||
    lower.includes("adviesgesprek") ||
    lower.includes("kennismakingsgesprek") ||
    lower.includes("carrièregesprek") ||
    lower.includes("belastingsaangifte") ||
    lower.includes("opvolggesprek") ||
    lower.includes("jaarlijkse opvolging")
  );
}

/**
 * Bepaalt of dit onderwerp een Financiële analyse is — werkt net als
 * `subjectInvitesLead` op het volledige, opgemaakte onderwerp (bv. "18:00 -
 * Financiële analyse Jan Janssens"), niet enkel op het kale type.
 */
export function isFinancieleAnalyseSubject(subject: string) {
  return subject.toLowerCase().includes("financiële analyse");
}

/**
 * Herleidt het kale gesprektype uit een volledig opgebouwd onderwerp (bv.
 * "18:00 - Adviesgesprek Jan Janssens" -> "Adviesgesprek"), voor gevallen
 * waar enkel de tekst van een al bestaande activiteit gekend is en niet meer
 * de oorspronkelijke fase-naam. "Opvolggesprek" wordt vóór "Adviesgesprek"
 * gecontroleerd zodat een woord dat toevallig beide bevat niet fout uitkomt.
 */
export function bareMeetingType(subject: string): string {
  const lower = subject.toLowerCase();
  if (lower.includes("opvolggesprek")) return "Opvolggesprek";
  if (lower.includes("jaarlijkse opvolging")) return "Jaarlijkse opvolging";
  if (lower.includes("financiële analyse")) return "Financiële analyse";
  if (lower.includes("adviesgesprek")) return "Adviesgesprek";
  if (lower.includes("kennismakingsgesprek")) return "Kennismakingsgesprek";
  if (lower.includes("carrièregesprek")) return "Carrièregesprek";
  return "";
}

/** Bouwt de afspraaknaam op in het vaste formaat "Uur - Type Voornaam Achternaam". */
export function buildMeetingSubject(
  scheduledAt: Date,
  meetingType: string,
  firstName: string,
  lastName: string
) {
  const type = meetingTypeFromStageLabel(meetingType);
  return `${formatLocalTime(scheduledAt)} - ${type} ${firstName} ${lastName}`;
}

export type MeetingPlannerValue = {
  scheduledAt: string;
  endTime: string;
  mode: "ONSITE" | "ONLINE";
  location: string;
  useGoogleMeet: boolean;
  subagentId: string;
  /** Vrije tekst die mee in de omschrijving van het Google Agenda-item komt — zichtbaar voor wie mee uitgenodigd is, dus ook de klant. */
  meetingDescription: string;
};

export const EMPTY_MEETING_PLANNER_VALUE: MeetingPlannerValue = {
  scheduledAt: "",
  endTime: "",
  mode: "ONSITE",
  location: "",
  useGoogleMeet: false,
  subagentId: "",
  meetingDescription: "",
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
  if (value.meetingDescription) {
    formData.set("meetingDescription", value.meetingDescription);
  }
  return formData;
}

export type FollowUpCallValue = { scheduledAt: string; notes: string };

export const EMPTY_FOLLOW_UP_CALL_VALUE: FollowUpCallValue = {
  scheduledAt: "",
  notes: "",
};

/** Zet de terugbelmoment-waarde om in FormData voor `planFollowUpCallAction`, of null als er geen tijdstip gekozen is. */
export function buildFollowUpCallFormData(
  value: FollowUpCallValue
): FormData | null {
  if (!value.scheduledAt) return null;
  const formData = new FormData();
  formData.set("scheduledAt", value.scheduledAt);
  if (value.notes) formData.set("notes", value.notes);
  return formData;
}
