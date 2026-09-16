import { prisma } from "@/lib/prisma";
import { encryptToken, decryptToken } from "@/lib/tokenCrypto";
import type { Activity, Event, Lead, Subagent, User } from "@/generated/prisma/client";
import { subjectInvitesLead, isFinancieleAnalyseSubject } from "@/lib/meetingPlanning";

type ContactInfo = { name: string; email: string | null; phone: string | null };

/** "32 4xx xx xx xx" (het vaste opslagformaat voor herkende Belgische mobiele nummers, zie formatBelgianPhone) toon je in een omschrijving als "+32 4xx xx xx xx". Nummers in een ander formaat (al een "+", een vast lijnnummer, ...) laat dit ongemoeid. */
function withPlusPrefix(phone: string) {
  return phone.startsWith("+") || !phone.startsWith("32") ? phone : `+${phone}`;
}

/**
 * Formatteert één contactregel voor de omschrijving (bv. "Jan Peeters —
 * Telefoon: ..."), zonder rol-label — enkel naam en telefoonnummer. Geen
 * e-mailadres: wie uitgenodigd is, ziet dat al bij de deelnemers van het
 * agenda-item zelf, dus dat zou hier dubbel op staan.
 */
function formatContactLine(person?: ContactInfo | null) {
  if (!person || !person.phone) return null;
  return `${person.name} — Telefoon: ${withPlusPrefix(person.phone)}`;
}

const SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/userinfo.email",
];

// `googleapis` is a very large package. It's only needed by the handful of
// requests that actually touch Google Calendar, but this module is reachable
// from almost every page (via ActivityButtons/ScheduleActivityForm), so a
// static import would bloat the server bundle — and cold-start time — for
// every route. Importing it lazily keeps it out of routes that never call
// these functions.
async function getGoogle() {
  const { google } = await import("googleapis");
  return google;
}

async function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google Calendar integratie is niet geconfigureerd (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI ontbreken)."
    );
  }

  const google = await getGoogle();
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Bouwt de consent-URL waarmee een gebruiker zijn Google agenda koppelt. */
export async function getGoogleConsentUrl(state: string) {
  const client = await getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "select_account consent",
    scope: SCOPES,
    state,
  });
}

/** Ruilt de OAuth-code na consent in voor tokens en koppelt de agenda aan de gebruiker. */
export async function connectGoogleCalendarForUser(
  userId: string,
  code: string
) {
  const client = await getOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Geen refresh token ontvangen van Google. Verwijder de app-toegang bij Google en probeer opnieuw (prompt=consent)."
    );
  }

  client.setCredentials(tokens);
  const google = await getGoogle();
  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data: profile } = await oauth2.userinfo.get();

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleCalendarConnected: true,
      googleCalendarRefreshToken: encryptToken(tokens.refresh_token),
      googleCalendarEmail: profile.email ?? null,
      googleCalendarId: "primary",
    },
  });
}

export async function disconnectGoogleCalendarForUser(userId: string) {
  await prisma.user.update({
    where: { id: userId },
    data: {
      googleCalendarConnected: false,
      googleCalendarRefreshToken: null,
      googleCalendarEmail: null,
    },
  });
}

async function getClientForUser(user: Pick<User, "googleCalendarRefreshToken">) {
  const client = await getOAuthClient();
  client.setCredentials({
    refresh_token: decryptToken(user.googleCalendarRefreshToken),
  });
  return client;
}

function buildEventBody(
  activity: Activity,
  lead: Lead,
  subagent?: Subagent | null,
  scheduledBy?: { name: string; email: string | null; phone: string | null } | null,
  owner?: ContactInfo | null,
  officeNote?: string | null,
  assigneeName?: string | null,
  /** True als scheduledBy dezelfde persoon is als de toegewezen gebruiker (op wiens agenda dit event komt). */
  isSelfScheduled?: boolean
) {
  const start = activity.scheduledAt ?? new Date();
  const durationMinutes = activity.durationMinutes ?? 15;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const leadName = `${lead.firstName} ${lead.lastName}`.trim();

  // Afspraken vanuit de planning-widget (afspraak of terugbelmoment) dragen
  // de leadnaam al in het onderwerp (via buildMeetingSubject, bv. "18:00 -
  // Financiële analyse Robin Ceuppens"), dus die mag dan niet nogmaals
  // toegevoegd worden aan de agenda-titel — vandaar deze check op de
  // effectieve inhoud i.p.v. op meetingMode (dat bij een terugbelmoment,
  // type CALL, niet gezet is, ook al bevat het onderwerp de naam al).
  const summary = leadName && activity.subject.includes(leadName)
    ? activity.subject
    : `${activity.subject} — ${leadName}`;

  const useGoogleMeet = activity.meetingMode === "ONLINE" && !activity.meetingLink;

  // De lead wordt enkel effectief uitgenodigd voor een Financiële analyse/
  // Adviesgesprek/Opvolggesprek — een uitgaand telefoongesprek, e-mail of
  // notitie is enkel een herinnering in de eigen agenda, geen afspraak mét
  // de klant, dus daar krijgt hij geen uitnodigingsmail voor.
  const invitesLead = subjectInvitesLead(activity.subject);

  // Wie deze afspraak heeft ingepland (bv. een Coach die inplant namens een
  // teamlid) wordt mee uitgenodigd als die niet dezelfde persoon is als de
  // toegewezen gebruiker — plant iemand voor zichzelf in, dan zou hij anders
  // zichzelf uitnodigen op zijn eigen agenda-item, wat Google Agenda
  // standaard als "in afwachting" toont, ook al is het gewoon zijn eigen
  // afspraak (zijn telefoonnummer blijft wel altijd in de omschrijving
  // staan hieronder, voor de uitgenodigde klant).
  const seenEmails = new Set<string>();
  const attendees: { email: string }[] = [];
  function addAttendee(email: string | null | undefined) {
    if (email && !seenEmails.has(email)) {
      seenEmails.add(email);
      attendees.push({ email });
    }
  }
  if (invitesLead) {
    addAttendee(lead.email);
  }
  addAttendee(subagent?.email);
  if (!isSelfScheduled) addAttendee(scheduledBy?.email);

  // Bij een fysieke afspraak op het kantooradres komt de vaste
  // bereikbaarheidsnotitie ("Kantoor" in het profielmenu) altijd mee in de
  // omschrijving, ongeacht of de klant mee uitgenodigd is — die moet het
  // kantoor immers ook kunnen vinden. "{naam}" daarin wordt vervangen door
  // wie de klant aan de balie moet vragen: de aanbrenger bij een Financiële
  // analyse, de subagent bij een Adviesgesprek, anders de toegewezen
  // medewerker.
  const advisorName = isFinancieleAnalyseSubject(activity.subject)
    ? owner?.name ?? null
    : subagent?.name ?? assigneeName ?? null;
  const officeNoteLine =
    activity.meetingMode === "ONSITE" && officeNote
      ? advisorName
        ? officeNote.replace(/\{naam\}/gi, advisorName)
        : officeNote
      : null;

  // Wordt de klant mee uitgenodigd, dan ziet hij deze beschrijving ook —
  // daar komen dus enkel de contactgegevens van wie de afspraak inplande
  // (of een eventuele subagent/aanbrenger, als die er is) in te staan
  // (zodat de klant weet bij wie hij terechtkan), nooit de interne
  // notities. Bij een gewoon uitgaand contactmoment (geen klant
  // uitgenodigd) is de beschrijving enkel voor onszelf, dus daar mogen de
  // notities wel in staan. Geen e-mailadres hier (zie formatContactLine):
  // wie uitgenodigd is, ziet dat al bij de deelnemers van het agenda-item.
  const subagentLine = formatContactLine(subagent);
  const aanbrengerLine = isFinancieleAnalyseSubject(activity.subject)
    ? formatContactLine(owner)
    : null;
  // De naamloze regel hieronder toont exact dezelfde persoon zodra die ook
  // als subagent/aanbrenger vermeld staat (bv. een subagent die zijn eigen
  // adviesgesprek inplant) — dan volstaat die ene, genoemde regel.
  const namedContactLine = subagentLine ?? aanbrengerLine;
  const description = invitesLead
    ? [
        namedContactLine
          ? null
          : scheduledBy?.phone
          ? `Telefoon: ${withPlusPrefix(scheduledBy.phone)}`
          : null,
        subagentLine,
        aanbrengerLine,
        activity.meetingMode === "ONLINE" && activity.meetingLink
          ? `Online via: ${activity.meetingLink}`
          : null,
        officeNoteLine,
      ]
        .filter(Boolean)
        .join("\n")
    : [activity.notes ? `Notities:\n${activity.notes}` : null, officeNoteLine]
        .filter(Boolean)
        .join("\n");

  return {
    summary,
    description,
    location:
      activity.meetingMode === "ONSITE" && activity.location
        ? activity.location
        : undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    ...(attendees.length > 0 ? { attendees } : {}),
    ...(useGoogleMeet
      ? {
          conferenceData: {
            createRequest: {
              requestId: activity.id,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
        }
      : {}),
  };
}

function extractMeetLink(eventData: {
  conferenceData?: { entryPoints?: { entryPointType?: string | null; uri?: string | null }[] | null } | null;
  hangoutLink?: string | null;
}) {
  const videoEntry = eventData.conferenceData?.entryPoints?.find(
    (entry) => entry.entryPointType === "video"
  );
  return videoEntry?.uri ?? eventData.hangoutLink ?? null;
}

/**
 * Maakt een Google Calendar event aan voor een ingeplande activiteit
 * (bv. een uitgaand telefoongesprek) en slaat het event-id op de activiteit op.
 */
export type GoogleCalendarUser = Pick<
  User,
  "googleCalendarConnected" | "googleCalendarRefreshToken" | "googleCalendarId"
>;

export async function syncActivityToGoogleCalendar(
  user: GoogleCalendarUser,
  activity: Activity,
  lead: Lead,
  subagent?: Subagent | null,
  scheduledBy?: { name: string; email: string | null; phone: string | null } | null,
  /** True als scheduledBy dezelfde persoon is als de toegewezen gebruiker (user hierboven) — zie buildEventBody. */
  isSelfScheduled?: boolean
) {
  if (!user.googleCalendarConnected || !user.googleCalendarRefreshToken) {
    // Zonder dit zag je nergens waarom een afspraak niet op de agenda stond
    // (de activiteit zelf werd wel gewoon aangemaakt) — dit hergebruikt
    // dezelfde melding als een echte sync-fout (zie leads/[id]/page.tsx),
    // want bij een uitnodigende afspraak (Financiële analyse, ...) krijgt de
    // klant zelf zo ook geen uitnodiging, dus dit is meer dan cosmetisch.
    await prisma.activity.update({
      where: { id: activity.id },
      data: {
        googleSyncError:
          "Geen Google Agenda gekoppeld bij de toegewezen medewerker — koppel deze bij Instellingen.",
      },
    });
    return { synced: false as const, reason: "not_connected" as const };
  }
  if (!activity.scheduledAt) {
    return { synced: false as const, reason: "no_schedule" as const };
  }

  // Kantoornotitie (bv. parkeerinfo) enkel nodig bij een fysieke afspraak;
  // aanbrenger-contactgegevens enkel bij een Financiële analyse; de naam van
  // de toegewezen medewerker enkel als terugval voor "{naam}" in de
  // kantoornotitie als er geen subagent/aanbrenger van toepassing is — alle
  // drie worden hier zelf opgehaald zodat callers deze niet hoeven mee te geven.
  const [officeSettings, owner, assigneeForNote] = await Promise.all([
    activity.meetingMode === "ONSITE" ? prisma.officeSettings.findFirst() : null,
    isFinancieleAnalyseSubject(activity.subject)
      ? prisma.user.findUnique({
          where: { id: lead.ownerId },
          select: { name: true, email: true, phone: true },
        })
      : null,
    activity.meetingMode === "ONSITE"
      ? prisma.user.findUnique({
          where: { id: activity.assigneeId },
          select: { name: true },
        })
      : null,
  ]);

  // De kantoornotitie (parkeer-/bereikbaarheidsinfo) is enkel relevant als
  // de afspraak ook effectief op het kantooradres plaatsvindt — niet bij een
  // fysieke afspraak "ter plaatse" op een zelf ingetypt (ander) adres.
  const isAtOffice = Boolean(
    officeSettings?.address && activity.location === officeSettings.address
  );

  const auth = await getClientForUser(user);
  const google = await getGoogle();
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = user.googleCalendarId ?? "primary";
  const eventBody = buildEventBody(
    activity,
    lead,
    subagent,
    scheduledBy,
    owner,
    isAtOffice ? officeSettings?.note : null,
    assigneeForNote?.name,
    isSelfScheduled
  );
  const conferenceDataVersion = eventBody.conferenceData ? 1 : undefined;
  // Stuurt automatisch een uitnodigingsmail naar de lead (en eventuele
  // subagent) als attendee op het agenda-item.
  const sendUpdates = eventBody.attendees ? "all" : undefined;

  try {
    let eventId = activity.googleEventId;
    let meetLink: string | null = null;

    if (eventId) {
      const { data } = await calendar.events.update({
        calendarId,
        eventId,
        conferenceDataVersion,
        sendUpdates,
        requestBody: eventBody,
      });
      meetLink = extractMeetLink(data);
    } else {
      const { data } = await calendar.events.insert({
        calendarId,
        conferenceDataVersion,
        sendUpdates,
        requestBody: eventBody,
      });
      eventId = data.id ?? null;
      meetLink = extractMeetLink(data);
    }

    await prisma.activity.update({
      where: { id: activity.id },
      data: {
        googleEventId: eventId,
        googleCalendarId: calendarId,
        googleSyncError: null,
        ...(meetLink ? { meetingLink: meetLink } : {}),
      },
    });

    return { synced: true as const, eventId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    await prisma.activity.update({
      where: { id: activity.id },
      data: { googleSyncError: message },
    });
    return { synced: false as const, reason: "error" as const, message };
  }
}

function buildEventInviteBody(event: Event, attendeeEmails: string[]) {
  const start = event.date;
  // Event heeft, in tegenstelling tot Activity, geen durationMinutes — bij
  // ontbrekend einduur valt dit terug op een uur, een redelijk standaard
  // voor een vergadering.
  const end = event.endDate ?? new Date(start.getTime() + 60 * 60_000);
  const attendees = attendeeEmails.map((email) => ({ email }));

  return {
    summary: event.title,
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
    ...(attendees.length > 0 ? { attendees } : {}),
  };
}

/**
 * Maakt (of werkt bij) het Google Agenda-item voor een evenement op de
 * agenda van `user` (de aanmaker), met de meegegeven e-mailadressen als
 * deelnemers — analoog aan syncActivityToGoogleCalendar, maar dan voor
 * Event i.p.v. Activity: geen lead/Zoom/kantoornotitie-logica, enkel
 * titel/omschrijving/locatie/tijd + deelnemers.
 */
export async function syncEventToGoogleCalendar(
  user: GoogleCalendarUser,
  event: Event,
  attendeeEmails: string[]
) {
  if (!user.googleCalendarConnected || !user.googleCalendarRefreshToken) {
    await prisma.event.update({
      where: { id: event.id },
      data: {
        googleSyncError:
          "Geen Google Agenda gekoppeld bij de aanmaker — koppel deze bij Instellingen om uitnodigingen te versturen.",
      },
    });
    return { synced: false as const, reason: "not_connected" as const };
  }

  const auth = await getClientForUser(user);
  const google = await getGoogle();
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = user.googleCalendarId ?? "primary";
  const eventBody = buildEventInviteBody(event, attendeeEmails);
  // Stuurt automatisch een uitnodigingsmail naar elke deelnemer.
  const sendUpdates = attendeeEmails.length > 0 ? "all" : undefined;

  try {
    let eventId = event.googleEventId;

    if (eventId) {
      await calendar.events.update({
        calendarId,
        eventId,
        sendUpdates,
        requestBody: eventBody,
      });
    } else {
      const { data } = await calendar.events.insert({
        calendarId,
        sendUpdates,
        requestBody: eventBody,
      });
      eventId = data.id ?? null;
    }

    await prisma.event.update({
      where: { id: event.id },
      data: {
        googleEventId: eventId,
        googleCalendarId: calendarId,
        googleSyncError: null,
      },
    });

    return { synced: true as const, eventId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Onbekende fout";
    await prisma.event.update({
      where: { id: event.id },
      data: { googleSyncError: message },
    });
    return { synced: false as const, reason: "error" as const, message };
  }
}

export async function deleteActivityFromGoogleCalendar(
  user: GoogleCalendarUser,
  activity: Activity
) {
  if (
    !user.googleCalendarConnected ||
    !user.googleCalendarRefreshToken ||
    !activity.googleEventId
  ) {
    return;
  }

  const auth = await getClientForUser(user);
  const google = await getGoogle();
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = activity.googleCalendarId ?? user.googleCalendarId ?? "primary";

  try {
    await calendar.events.delete({ calendarId, eventId: activity.googleEventId });
  } catch {
    // Event kan al verwijderd zijn in Google Calendar zelf; dat is geen fout hier.
  }
}
