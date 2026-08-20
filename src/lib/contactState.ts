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
  const hasPlannedCallback = activities.some(
    (a) => a.type === "CALL" && a.status === "PLANNED" && a.scheduledAt && a.scheduledAt > now
  );
  if (hasPlannedCallback) return "TERUGKOPPELEN";

  const completedCalls = activities.filter(
    (a) => a.type === "CALL" && a.status === "COMPLETED"
  );
  const wasReached = completedCalls.some((a) => !a.wasVoicemail);
  if (wasReached) return "OVERIG";

  return completedCalls.some((a) => a.wasVoicemail) ? "VOICEMAIL" : "TE_CONTACTEREN";
}
