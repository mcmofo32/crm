/**
 * Contactstatus van een lead, afgeleid uit zijn activiteiten-historiek
 * (niet als kolom opgeslagen). Gedeeld tussen de Pipeline-pagina en de
 * Leads-lijst, zodat beide dezelfde definitie van "te contacteren"/
 * "voicemail"/... hanteren.
 */
export type ContactState = "TE_CONTACTEREN" | "VOICEMAIL" | "TERUGKOPPELEN" | "OVERIG";

export function contactState(
  activities: { type: string; status: string; scheduledAt: Date | null; wasVoicemail: boolean }[]
): ContactState {
  const now = new Date();
  // Een geplande afspraak (Financiële analyse, Adviesgesprek, Opvolggesprek,
  // ...) is net zo goed een toekomstig contactmoment als een teruggepland
  // telefoongesprek — anders bleef een lead met een afspraak op de kalender
  // toch als "te contacteren" gelden, enkel omdat er nooit een CALL-activiteit
  // voor gelogd werd.
  const hasPlannedCallback = activities.some(
    (a) =>
      (a.type === "CALL" || a.type === "MEETING") &&
      a.status === "PLANNED" &&
      a.scheduledAt &&
      a.scheduledAt > now
  );
  if (hasPlannedCallback) return "TERUGKOPPELEN";

  const completedCalls = activities.filter(
    (a) => a.type === "CALL" && a.status === "COMPLETED"
  );
  const hadCompletedMeeting = activities.some(
    (a) => a.type === "MEETING" && a.status === "COMPLETED"
  );
  const wasReached = completedCalls.some((a) => !a.wasVoicemail) || hadCompletedMeeting;
  if (wasReached) return "OVERIG";

  return completedCalls.some((a) => a.wasVoicemail) ? "VOICEMAIL" : "TE_CONTACTEREN";
}
