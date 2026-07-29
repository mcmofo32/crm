import { google } from "googleapis";
import { prisma } from "@/lib/prisma";
import type { Activity, Lead, User } from "@/generated/prisma/client";

const SCOPES = ["https://www.googleapis.com/auth/calendar.events"];

function getOAuthClient() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI;

  if (!clientId || !clientSecret || !redirectUri) {
    throw new Error(
      "Google Calendar integratie is niet geconfigureerd (GOOGLE_CLIENT_ID/SECRET/REDIRECT_URI ontbreken)."
    );
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

/** Bouwt de consent-URL waarmee een gebruiker zijn Google agenda koppelt. */
export function getGoogleConsentUrl(state: string) {
  const client = getOAuthClient();
  return client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    scope: SCOPES,
    state,
  });
}

/** Ruilt de OAuth-code na consent in voor tokens en koppelt de agenda aan de gebruiker. */
export async function connectGoogleCalendarForUser(
  userId: string,
  code: string
) {
  const client = getOAuthClient();
  const { tokens } = await client.getToken(code);

  if (!tokens.refresh_token) {
    throw new Error(
      "Geen refresh token ontvangen van Google. Verwijder de app-toegang bij Google en probeer opnieuw (prompt=consent)."
    );
  }

  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ auth: client, version: "v2" });
  const { data: profile } = await oauth2.userinfo.get();

  await prisma.user.update({
    where: { id: userId },
    data: {
      googleCalendarConnected: true,
      googleCalendarRefreshToken: tokens.refresh_token,
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

function getClientForUser(user: Pick<User, "googleCalendarRefreshToken">) {
  const client = getOAuthClient();
  client.setCredentials({ refresh_token: user.googleCalendarRefreshToken });
  return client;
}

function buildEventBody(activity: Activity, lead: Lead) {
  const start = activity.scheduledAt ?? new Date();
  const durationMinutes = activity.durationMinutes ?? 15;
  const end = new Date(start.getTime() + durationMinutes * 60_000);
  const leadName = `${lead.firstName} ${lead.lastName}`.trim();

  // Afspraken vanuit de planning-widget dragen de leadnaam al in het
  // onderwerp (bv. "18:00 - Financiële analyse Robin Ceuppens"), dus die
  // hoeft dan niet nogmaals toegevoegd te worden aan de agenda-titel.
  const summary = activity.meetingMode
    ? activity.subject
    : `${activity.subject} — ${leadName}`;

  const useGoogleMeet = activity.meetingMode === "ONLINE" && !activity.meetingLink;

  return {
    summary,
    description: [
      `Type: ${activity.type}`,
      lead.phone ? `Telefoon: ${lead.phone}` : null,
      lead.email ? `E-mail: ${lead.email}` : null,
      activity.meetingMode === "ONLINE" && activity.meetingLink
        ? `\nOnline via: ${activity.meetingLink}`
        : null,
      activity.notes ? `\nNotities:\n${activity.notes}` : null,
    ]
      .filter(Boolean)
      .join("\n"),
    location:
      activity.meetingMode === "ONSITE" && activity.location
        ? activity.location
        : undefined,
    start: { dateTime: start.toISOString() },
    end: { dateTime: end.toISOString() },
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
export async function syncActivityToGoogleCalendar(
  user: User,
  activity: Activity,
  lead: Lead
) {
  if (!user.googleCalendarConnected || !user.googleCalendarRefreshToken) {
    return { synced: false as const, reason: "not_connected" as const };
  }
  if (!activity.scheduledAt) {
    return { synced: false as const, reason: "no_schedule" as const };
  }

  const auth = getClientForUser(user);
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = user.googleCalendarId ?? "primary";
  const eventBody = buildEventBody(activity, lead);
  const conferenceDataVersion = eventBody.conferenceData ? 1 : undefined;

  try {
    let eventId = activity.googleEventId;
    let meetLink: string | null = null;

    if (eventId) {
      const { data } = await calendar.events.update({
        calendarId,
        eventId,
        conferenceDataVersion,
        requestBody: eventBody,
      });
      meetLink = extractMeetLink(data);
    } else {
      const { data } = await calendar.events.insert({
        calendarId,
        conferenceDataVersion,
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

export async function deleteActivityFromGoogleCalendar(
  user: User,
  activity: Activity
) {
  if (
    !user.googleCalendarConnected ||
    !user.googleCalendarRefreshToken ||
    !activity.googleEventId
  ) {
    return;
  }

  const auth = getClientForUser(user);
  const calendar = google.calendar({ version: "v3", auth });
  const calendarId = activity.googleCalendarId ?? user.googleCalendarId ?? "primary";

  try {
    await calendar.events.delete({ calendarId, eventId: activity.googleEventId });
  } catch {
    // Event kan al verwijderd zijn in Google Calendar zelf; dat is geen fout hier.
  }
}
