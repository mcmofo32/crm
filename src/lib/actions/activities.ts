"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ActivityStatus, ActivityType, MeetingMode } from "@/generated/prisma/client";
import { canAccessOwner, canDeleteActivities } from "@/lib/permissions";
import {
  deleteActivityFromGoogleCalendar,
  syncActivityToGoogleCalendar,
} from "@/lib/googleCalendar";

/** Enkel de velden die syncActivityToGoogleCalendar/deleteActivityFromGoogleCalendar nodig hebben — bespaart de (soms grote) avatarData-blob op elke activiteit-actie. */
const GOOGLE_CALENDAR_USER_SELECT = {
  googleCalendarConnected: true,
  googleCalendarRefreshToken: true,
  googleCalendarId: true,
} as const;
import { logAudit } from "@/lib/audit";
import { getEffectiveViewer } from "@/lib/impersonation";
import { updateLeadStageAction } from "@/lib/actions/leads";
import {
  isPlanningStage,
  isRichMeetingType,
  isFollowUpStage,
  isAdviesgesprekType,
  isOpvolggesprekType,
  buildMeetingSubject,
  bareMeetingType,
} from "@/lib/meetingPlanning";
import { parseLocalDateTime, combineWithTimeOnSameLocalDay } from "@/lib/datetime";
import { getOfficeSettings } from "@/lib/actions/officeSettings";

/**
 * Voor logboek-beschrijvingen: het onderwerp van een afspraak bevat enkel het
 * uur (zie buildMeetingSubject), niet de datum — zonder dit expliciet erbij
 * te zetten is een verwijderde/geannuleerde afspraak niet meer te herinplannen
 * omdat de datum nergens anders bewaard blijft.
 */
function formatScheduledAtForLog(scheduledAt: Date | null) {
  if (!scheduledAt) return "geen datum";
  return scheduledAt.toLocaleString("nl-BE", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "Europe/Brussels",
  });
}

/** ONSITE-locatie: getypt adres, anders het kantooradres (zie "Kantoor" in het profielmenu) als dat ingesteld is. */
async function resolveOnsiteLocation(typedLocation: string) {
  if (typedLocation) return typedLocation;
  const officeSettings = await getOfficeSettings();
  return officeSettings?.address ?? null;
}

async function requireUser() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  return viewer;
}

/**
 * Contactgegevens van wie een afspraak inplant — komen in de beschrijving
 * van het Google Agenda-item te staan zodra de klant mee uitgenodigd wordt
 * (zie subjectInvitesLead), zodat de klant weet bij wie hij terechtkan.
 */
async function buildScheduledBy(user: { id: string; name: string; email: string }) {
  const record = await prisma.user.findUnique({
    where: { id: user.id },
    select: { phone: true },
  });
  return { name: user.name, email: user.email || null, phone: record?.phone ?? null };
}

async function requireLeadAccess(leadId: string) {
  const [user, lead] = await Promise.all([
    requireUser(),
    prisma.lead.findUnique({ where: { id: leadId } }),
  ]);
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessOwner(user, lead.ownerId))) {
    throw new Error("Geen toegang tot deze lead");
  }
  return { user, lead };
}

/**
 * Plant een opvolgactiviteit in voor een lead en zet ze automatisch in de
 * Google Agenda van de toegewezen gebruiker. Voor "Financiële analyse" en
 * "Adviesgesprek" wordt dezelfde rijke planning toegepast als bij een
 * stage-move (vast onderwerpformaat, fysiek/online, Zoom/Meet, subagent,
 * automatische uitnodiging van de lead) — met een zelf in te vullen einduur
 * i.p.v. een vaste duurtijd. Voor andere onderwerpen blijft het eenvoudige
 * duurtijd-dropdown behouden.
 */
export async function scheduleActivityAction(formData: FormData) {
  const leadId = String(formData.get("leadId"));
  const { user, lead } = await requireLeadAccess(leadId);

  const assigneeId = String(formData.get("assigneeId") ?? user.id);
  if (!(await canAccessOwner(user, assigneeId))) {
    throw new Error("Je mag deze activiteit niet aan deze gebruiker toewijzen");
  }

  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "");
  const scheduledAt = scheduledAtRaw ? parseLocalDateTime(scheduledAtRaw) : null;
  const skipCalendarSync = formData.get("skipCalendarSync") === "on";

  const rawSubject = String(formData.get("subject") ?? "Telefoongesprek").trim();
  const richMeeting = Boolean(scheduledAt) && isRichMeetingType(rawSubject);

  let subject = rawSubject;
  let durationMinutes = Number(formData.get("durationMinutes") ?? 15);
  let meetingMode: MeetingMode | null = null;
  let location: string | null = null;
  let meetingLink: string | null = null;
  let subagentId: string | null = null;
  let subagent = null;

  if (richMeeting && scheduledAt) {
    const endTimeRaw = String(formData.get("endTime") ?? "");
    if (!endTimeRaw) throw new Error("Kies een einduur voor de afspraak");
    const endAt = combineWithTimeOnSameLocalDay(scheduledAt, endTimeRaw);
    durationMinutes = Math.round((endAt.getTime() - scheduledAt.getTime()) / 60_000);
    if (durationMinutes <= 0) {
      throw new Error("Het einduur moet na het startuur liggen");
    }

    meetingMode =
      formData.get("mode") === "ONLINE" ? MeetingMode.ONLINE : MeetingMode.ONSITE;
    location =
      meetingMode === MeetingMode.ONSITE
        ? await resolveOnsiteLocation(String(formData.get("location") ?? "").trim())
        : null;
    const useGoogleMeet =
      meetingMode === MeetingMode.ONLINE && formData.get("useGoogleMeet") === "on";

    if (meetingMode === MeetingMode.ONLINE && !useGoogleMeet) {
      const assignee = await prisma.user.findUnique({
        where: { id: assigneeId },
        select: { zoomLink: true },
      });
      meetingLink = assignee?.zoomLink ?? null;
      if (!meetingLink) {
        throw new Error(
          "De toegewezen gebruiker heeft nog geen Zoom-link ingesteld bij Instellingen. Kies Google Meet, of vraag dit eerst in te stellen."
        );
      }
    }

    subagentId = String(formData.get("subagentId") ?? "").trim() || null;
    if (subagentId) {
      subagent = await prisma.subagent.findUnique({ where: { id: subagentId } });
      if (!subagent) throw new Error("Subagent niet gevonden");
    }

    subject = buildMeetingSubject(scheduledAt, rawSubject, lead.firstName, lead.lastName);
  }

  const meetingDescription =
    String(formData.get("meetingDescription") ?? "").trim() || null;

  const activity = await prisma.activity.create({
    data: {
      leadId,
      assigneeId,
      type: richMeeting
        ? ActivityType.MEETING
        : (formData.get("type") as ActivityType) ?? ActivityType.CALL,
      subject,
      notes: (formData.get("notes") as string) || null,
      scheduledAt,
      durationMinutes,
      status: ActivityStatus.PLANNED,
      meetingMode,
      location,
      meetingLink,
      subagentId,
      meetingDescription,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { lastContactedAt: new Date() },
  });

  if (scheduledAt && !skipCalendarSync) {
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
      select: GOOGLE_CALENDAR_USER_SELECT,
    });
    if (assignee) {
      // Wie de afspraak effectief inplant staat mee als deelnemer, tenzij
      // dat dezelfde persoon is als de toegewezen gebruiker — anders nodig
      // je jezelf uit op je eigen agenda-item, wat Google Agenda standaard
      // als "in afwachting" toont (zie buildEventBody in googleCalendar.ts).
      const scheduledBy = await buildScheduledBy(user);
      await syncActivityToGoogleCalendar(
        assignee,
        activity,
        lead,
        subagent,
        scheduledBy,
        user.id === assigneeId
      );
    }
  }

  // Het inplannen van bv. een Financiële analyse/Adviesgesprek verplaatst de
  // lead meteen naar de bijhorende "...ingepland"-fase, als die bestaat.
  if (richMeeting) {
    const matchingStage = await prisma.funnelStage.findFirst({
      where: {
        leadType: lead.leadType,
        label: { equals: `${rawSubject} ingepland`, mode: "insensitive" },
      },
    });
    if (matchingStage && matchingStage.id !== lead.stageId) {
      await updateLeadStageAction(leadId, matchingStage.id);
    }
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/taken");
  revalidatePath("/dashboard");
}

/**
 * Rapporteert een contactmoment dat al heeft plaatsgevonden (bv. "telefoontje
 * gehad met de klant over X"). Wordt meteen als afgerond gelogd in de
 * communicatiegeschiedenis van de lead, zonder Google Agenda-item (dat is
 * enkel voor toekomstige, in te plannen activiteiten).
 */
export async function logCompletedActivityAction(formData: FormData) {
  const leadId = String(formData.get("leadId"));
  const { user, lead } = await requireLeadAccess(leadId);

  const assigneeId = String(formData.get("assigneeId") ?? user.id);
  if (!(await canAccessOwner(user, assigneeId))) {
    throw new Error("Je mag deze activiteit niet aan deze gebruiker toewijzen");
  }

  const occurredAtRaw = String(formData.get("occurredAt") ?? "");
  const occurredAt = occurredAtRaw ? parseLocalDateTime(occurredAtRaw) : new Date();
  const type = (formData.get("type") as ActivityType) ?? ActivityType.CALL;

  await prisma.activity.create({
    data: {
      leadId,
      assigneeId,
      type,
      subject: String(formData.get("subject") ?? "Contact"),
      notes: (formData.get("notes") as string) || null,
      scheduledAt: occurredAt,
      completedAt: occurredAt,
      durationMinutes: Number(formData.get("durationMinutes") ?? 15),
      status: ActivityStatus.COMPLETED,
      ...(type === ActivityType.CALL
        ? { wasVoicemail: formData.get("wasVoicemail") === "on" }
        : {}),
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { lastContactedAt: occurredAt },
  });

  // Een eerste gerapporteerd contact verplaatst de lead automatisch van de
  // openingsfase (bv. "Nieuwe lead") naar de eerstvolgende fase (bv. "Eerste
  // contact"). Latere rapporten verplaatsen niets automatisch.
  const currentStage = await prisma.funnelStage.findUnique({
    where: { id: lead.stageId },
  });
  if (currentStage && currentStage.order === 0) {
    const nextStage = await prisma.funnelStage.findFirst({
      where: { leadType: lead.leadType, order: currentStage.order + 1 },
    });
    if (nextStage) {
      await updateLeadStageAction(leadId, nextStage.id);
    }
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/pipeline/verkoop");
  revalidatePath("/pipeline/recrutering");
}

export async function completeActivityAction(
  activityId: string,
  notes?: string,
  wasVoicemail?: boolean
) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  });
  if (!activity) throw new Error("Activiteit niet gevonden");
  await requireLeadAccess(activity.leadId);

  await prisma.activity.update({
    where: { id: activityId },
    data: {
      status: ActivityStatus.COMPLETED,
      completedAt: new Date(),
      notes: notes ?? activity.notes,
      ...(activity.type === ActivityType.CALL
        ? { wasVoicemail: Boolean(wasVoicemail) }
        : {}),
    },
  });

  revalidatePath(`/leads/${activity.leadId}`);
  revalidatePath("/taken");
  revalidatePath("/dashboard");
  revalidatePath("/pipeline/verkoop");
  revalidatePath("/pipeline/recrutering");
}

/**
 * Past een nog geplande afspraak aan. Voor eenvoudige activiteiten
 * (Telefoongesprek/E-mail/Notitie) enkel type/onderwerp/tijdstip/duur. Voor
 * een rijke afspraak (Financiële analyse/Adviesgesprek/...) — herkenbaar aan
 * `meetingMode !== null` — ook Van/Tot, fysiek/online, locatie/Zoom-Meet en
 * subagent, net als bij het oorspronkelijk inplannen; onderwerp/type blijven
 * dan ongewijzigd (bepalen de fase-koppeling, niet in scope van een
 * logistieke aanpassing). Synchroniseert het bestaande Google Agenda-item
 * mee.
 */
export async function updateActivityAction(
  activityId: string,
  formData: FormData
): Promise<PlanMeetingResult> {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  });
  if (!activity) throw new Error("Activiteit niet gevonden");
  if (activity.status !== ActivityStatus.PLANNED) {
    throw new Error("Enkel geplande afspraken kunnen aangepast worden");
  }
  const { user, lead } = await requireLeadAccess(activity.leadId);

  const feedback = String(formData.get("notes") ?? "").trim();
  const isRichMeeting = activity.meetingMode !== null;

  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "");
  const scheduledAt = scheduledAtRaw
    ? parseLocalDateTime(scheduledAtRaw)
    : activity.scheduledAt;

  let durationMinutes = Number(
    formData.get("durationMinutes") ?? activity.durationMinutes ?? 15
  );
  let meetingMode = activity.meetingMode;
  let location = activity.location;
  let meetingLink = activity.meetingLink;
  let subagentId = activity.subagentId;
  let subagent = null;
  let type = activity.type;
  let subject = activity.subject;

  if (isRichMeeting) {
    if (!scheduledAt) return { error: "Kies een datum en uur voor de afspraak" };

    const endTimeRaw = String(formData.get("endTime") ?? "");
    if (!endTimeRaw) return { error: "Kies een einduur voor de afspraak" };
    const endAt = combineWithTimeOnSameLocalDay(scheduledAt, endTimeRaw);
    durationMinutes = Math.round((endAt.getTime() - scheduledAt.getTime()) / 60_000);
    if (durationMinutes <= 0) {
      return { error: "Het einduur moet na het startuur liggen" };
    }

    meetingMode =
      formData.get("mode") === "ONLINE" ? MeetingMode.ONLINE : MeetingMode.ONSITE;
    location =
      meetingMode === MeetingMode.ONSITE
        ? await resolveOnsiteLocation(String(formData.get("location") ?? "").trim())
        : null;
    const useGoogleMeet =
      meetingMode === MeetingMode.ONLINE && formData.get("useGoogleMeet") === "on";

    meetingLink = null;
    if (meetingMode === MeetingMode.ONLINE && !useGoogleMeet) {
      const assigneeUser = await prisma.user.findUnique({
        where: { id: activity.assigneeId },
        select: { zoomLink: true },
      });
      meetingLink = assigneeUser?.zoomLink ?? null;
      if (!meetingLink) {
        return {
          error:
            "De toegewezen gebruiker heeft nog geen Zoom-link ingesteld bij Instellingen. Kies Google Meet, of vraag dit eerst in te stellen.",
        };
      }
    }

    subagentId = String(formData.get("subagentId") ?? "").trim() || null;
    if (subagentId) {
      subagent = await prisma.subagent.findUnique({ where: { id: subagentId } });
      if (!subagent) return { error: "Subagent niet gevonden" };
    }
    const bareType = bareMeetingType(activity.subject);
    if (
      !subagentId &&
      (isAdviesgesprekType(bareType) || isOpvolggesprekType(bareType))
    ) {
      return { error: "Duid een subagent aan om deze afspraak in te plannen" };
    }
    // De titel bevat het uur (zie buildMeetingSubject) — zonder dit opnieuw
    // op te bouwen bleef de oude titel (met het oude uur) staan nadat enkel
    // het tijdstip van een afspraak gewijzigd werd.
    subject = buildMeetingSubject(scheduledAt, bareType, lead.firstName, lead.lastName);
  } else {
    type = (formData.get("type") as ActivityType) ?? activity.type;
    subject = String(formData.get("subject") ?? activity.subject);
  }

  // In tegenstelling tot notes hieronder (aparte rapporteer-flow die nooit
  // per ongeluk mag wissen) is dit veld gewoon een normaal formulierveld
  // vooraf ingevuld met de huidige waarde — leeg opslaan wist het dus bewust.
  const meetingDescription =
    String(formData.get("meetingDescription") ?? "").trim() || null;

  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: {
      type,
      subject,
      // Leeg gelaten (nu optioneel) mag de bestaande notities niet wissen.
      notes: feedback || activity.notes,
      scheduledAt,
      durationMinutes,
      meetingMode,
      location,
      meetingLink,
      subagentId,
      meetingDescription,
    },
  });

  await logAudit({
    actorId: user.id,
    action: "activity.updated",
    entityType: "Activity",
    entityId: activityId,
    description: `Activiteit "${activity.subject}" bij lead "${lead.firstName} ${lead.lastName}" gewijzigd${
      feedback ? `: ${feedback}` : ""
    }`,
  });

  const assignee = await prisma.user.findUnique({
    where: { id: activity.assigneeId },
    select: GOOGLE_CALENDAR_USER_SELECT,
  });
  if (assignee && scheduledAt) {
    // Anders valt bv. de subagent-contactregel (zie buildEventBody) weg uit
    // de omschrijving zodra een afspraak nadien gewijzigd wordt. scheduledBy
    // hier opnieuw meegeven (i.p.v. wie de afspraak oorspronkelijk insplande,
    // wat niet bijgehouden wordt) is nodig, anders verdwijnt de organisator
    // als gast uit de agenda-uitnodiging zodra deze wijziging opnieuw
    // gesynchroniseerd wordt (events.update herschrijft de volledige
    // deelnemerslijst, zie buildEventBody).
    const scheduledBy = await buildScheduledBy(user);
    await syncActivityToGoogleCalendar(
      assignee,
      updated,
      lead,
      subagent,
      scheduledBy,
      user.id === activity.assigneeId
    );
  }

  revalidatePath(`/leads/${activity.leadId}`);
  revalidatePath("/taken");
  revalidatePath("/dashboard");
}

/** Verwijdert een activiteit definitief (en het bijhorende Google Agenda-item). */
export async function deleteActivityAction(activityId: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  });
  if (!activity) throw new Error("Activiteit niet gevonden");
  const { user, lead } = await requireLeadAccess(activity.leadId);
  if (!canDeleteActivities(user)) {
    throw new Error("Enkel de Beheerder mag activiteiten definitief verwijderen");
  }

  const assignee = await prisma.user.findUnique({
    where: { id: activity.assigneeId },
    select: GOOGLE_CALENDAR_USER_SELECT,
  });
  if (assignee) {
    await deleteActivityFromGoogleCalendar(assignee, activity);
  }

  await prisma.activity.delete({ where: { id: activityId } });

  await logAudit({
    actorId: user.id,
    action: "activity.deleted",
    entityType: "Activity",
    entityId: activityId,
    description: `Activiteit "${activity.subject}" verwijderd bij lead "${lead.firstName} ${lead.lastName}" (was gepland op ${formatScheduledAtForLog(activity.scheduledAt)})`,
  });

  revalidatePath(`/leads/${activity.leadId}`);
  revalidatePath("/taken");
  revalidatePath("/dashboard");
}

export async function cancelActivityAction(activityId: string) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  });
  if (!activity) throw new Error("Activiteit niet gevonden");
  const { user, lead } = await requireLeadAccess(activity.leadId);

  const assignee = await prisma.user.findUnique({
    where: { id: activity.assigneeId },
    select: GOOGLE_CALENDAR_USER_SELECT,
  });
  if (assignee) {
    await deleteActivityFromGoogleCalendar(assignee, activity);
  }

  await prisma.activity.update({
    where: { id: activityId },
    data: { status: ActivityStatus.CANCELLED },
  });

  await logAudit({
    actorId: user.id,
    action: "activity.cancelled",
    entityType: "Activity",
    entityId: activityId,
    description: `Activiteit "${activity.subject}" geannuleerd bij lead "${lead.firstName} ${lead.lastName}" (was gepland op ${formatScheduledAtForLog(activity.scheduledAt)})`,
  });

  revalidatePath(`/leads/${activity.leadId}`);
  revalidatePath("/taken");
  revalidatePath("/dashboard");
}

/**
 * Plant een afspraak (fysiek of online) in voor het verplaatsen van een lead
 * naar een "...ingepland"-fase (bv. Financiële analyse ingepland,
 * Adviesgesprek ingepland) — `toStageId` is de doelfase, niet noodzakelijk
 * (en typisch nog niet) de huidige fase van de lead: de aanroeper (Funnel-
 * Board/StageSelect) roept dit bewust vóór updateLeadStageAction aan, zodat
 * de lead pas effectief verplaatst wordt nadat dit gelukt is — anders zou
 * een lead in een "...ingepland"-fase kunnen belanden zonder dat er ooit een
 * afspraak (met, waar verplicht, een subagent) ingepland werd. Bij online
 * zonder Google Meet wordt de eigen Zoom-link van de toegewezen gebruiker
 * (Instellingen) in de omschrijving gezet; met Google Meet genereert Google
 * zelf een meet-link op het agenda-item.
 */
/**
 * Server Actions redacten in productie de boodschap van elke fout die
 * gegooid wordt (enkel een digest blijft over — zie updateUserAction in
 * users.ts) — deze validatiefouten moeten de gebruiker net wél expliciet
 * vertellen wat er mis is, dus die komen terug als { error } i.p.v. een
 * throw. De aanroepers (FunnelBoard/StageSelect) zetten dit om in een
 * gewone client-side Error, die runWithToast dan wél ongeschonden toont.
 */
export type PlanMeetingResult = { error: string } | undefined;

export async function planStageMeetingAction(
  leadId: string,
  toStageId: string,
  formData: FormData
): Promise<PlanMeetingResult> {
  const { user, lead } = await requireLeadAccess(leadId);

  const [freshLead, toStage] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId } }),
    prisma.funnelStage.findUnique({ where: { id: toStageId } }),
  ]);
  if (!freshLead) return { error: "Lead niet gevonden" };
  if (!toStage || toStage.leadType !== freshLead.leadType) {
    return { error: "Ongeldige funnel-stage" };
  }
  if (!isPlanningStage(toStage.label)) {
    return {
      error: "Een afspraak inplannen kan enkel in een '...ingepland'-fase",
    };
  }

  const assignee = await prisma.user.findUnique({
    where: { id: freshLead.ownerId },
    select: { zoomLink: true, ...GOOGLE_CALENDAR_USER_SELECT },
  });
  if (!assignee) return { error: "Eigenaar van deze lead niet gevonden" };

  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "");
  if (!scheduledAtRaw) return { error: "Kies een datum en uur voor de afspraak" };
  const scheduledAt = parseLocalDateTime(scheduledAtRaw);

  const endTimeRaw = String(formData.get("endTime") ?? "");
  if (!endTimeRaw) return { error: "Kies een einduur voor de afspraak" };
  const endAt = combineWithTimeOnSameLocalDay(scheduledAt, endTimeRaw);
  const durationMinutes = Math.round((endAt.getTime() - scheduledAt.getTime()) / 60_000);
  if (durationMinutes <= 0) {
    return { error: "Het einduur moet na het startuur liggen" };
  }

  const mode =
    formData.get("mode") === "ONLINE" ? MeetingMode.ONLINE : MeetingMode.ONSITE;
  const location =
    mode === MeetingMode.ONSITE
      ? await resolveOnsiteLocation(String(formData.get("location") ?? "").trim())
      : null;
  const useGoogleMeet =
    mode === MeetingMode.ONLINE && formData.get("useGoogleMeet") === "on";

  const subagentId = String(formData.get("subagentId") ?? "").trim() || null;
  const subagent = subagentId
    ? await prisma.subagent.findUnique({ where: { id: subagentId } })
    : null;
  if (subagentId && !subagent) return { error: "Subagent niet gevonden" };
  if (
    !subagentId &&
    (isAdviesgesprekType(toStage.label) || isOpvolggesprekType(toStage.label))
  ) {
    return { error: "Duid een subagent aan om deze afspraak in te plannen" };
  }

  // Zit er een subagent bij (bv. om het adviesgesprek te sluiten), dan voert
  // die het gesprek — zijn eigen Zoom-link komt dan in de afspraak, niet die
  // van de eigenaar van de lead (die vaak niet eens aanwezig is).
  let meetingLink: string | null = null;
  if (mode === MeetingMode.ONLINE && !useGoogleMeet) {
    if (subagent) {
      const subagentUser = subagent.userId
        ? await prisma.user.findUnique({
            where: { id: subagent.userId },
            select: { zoomLink: true },
          })
        : null;
      meetingLink = subagentUser?.zoomLink ?? null;
      if (!meetingLink) {
        return {
          error: subagent.userId
            ? `${subagent.name} heeft nog geen Zoom-link ingesteld bij Instellingen. Kies Google Meet, of vraag hen dit eerst in te stellen.`
            : `${subagent.name} heeft geen Zoom-link beschikbaar (geen account). Kies Google Meet, of geef de link zelf door.`,
        };
      }
    } else {
      meetingLink = assignee.zoomLink;
      if (!meetingLink) {
        return {
          error:
            "De eigenaar van deze lead heeft nog geen Zoom-link ingesteld bij Instellingen. Kies Google Meet, of vraag de eigenaar dit eerst in te stellen.",
        };
      }
    }
  }

  const subject = buildMeetingSubject(
    scheduledAt,
    toStage.label,
    freshLead.firstName,
    freshLead.lastName
  );

  const meetingDescription =
    String(formData.get("meetingDescription") ?? "").trim() || null;

  const activity = await prisma.activity.create({
    data: {
      leadId,
      assigneeId: freshLead.ownerId,
      type: ActivityType.MEETING,
      subject,
      scheduledAt,
      durationMinutes,
      status: ActivityStatus.PLANNED,
      meetingMode: mode,
      location,
      meetingLink,
      subagentId,
      meetingDescription,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { lastContactedAt: new Date() },
  });

  // Wie de afspraak effectief inplant staat mee als deelnemer, tenzij dat
  // dezelfde persoon is als de eigenaar van de lead (zie scheduleActivityAction).
  const scheduledBy = await buildScheduledBy(user);
  await syncActivityToGoogleCalendar(
    assignee,
    activity,
    freshLead,
    subagent,
    scheduledBy,
    user.id === freshLead.ownerId
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/funnel/${lead.leadType}`);
  revalidatePath("/taken");
  revalidatePath("/dashboard");
}

/**
 * Plant een uitgaand telefoongesprek in voor het verplaatsen van een lead
 * naar de "Opvolging"-fase — een lichtere variant van
 * `planStageMeetingAction` (enkel datum/uur, geen fysiek/online/subagent),
 * die net als een afspraak automatisch in de Google Agenda van de eigenaar
 * komt te staan. `toStageId` is de doelfase (zie planStageMeetingAction voor
 * waarom dit vóór updateLeadStageAction aangeroepen wordt).
 */
export async function planFollowUpCallAction(
  leadId: string,
  toStageId: string,
  formData: FormData
): Promise<PlanMeetingResult> {
  const { user, lead } = await requireLeadAccess(leadId);

  const [freshLead, toStage] = await Promise.all([
    prisma.lead.findUnique({ where: { id: leadId } }),
    prisma.funnelStage.findUnique({ where: { id: toStageId } }),
  ]);
  if (!freshLead) return { error: "Lead niet gevonden" };
  if (!toStage || toStage.leadType !== freshLead.leadType) {
    return { error: "Ongeldige funnel-stage" };
  }
  if (!isFollowUpStage(toStage.label)) {
    return { error: "Een terugbelmoment inplannen kan enkel in de fase 'Opvolging'" };
  }

  const assignee = await prisma.user.findUnique({
    where: { id: freshLead.ownerId },
    select: GOOGLE_CALENDAR_USER_SELECT,
  });
  if (!assignee) return { error: "Eigenaar van deze lead niet gevonden" };

  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "");
  if (!scheduledAtRaw) return { error: "Kies een datum en uur voor het terugbelmoment" };
  const scheduledAt = parseLocalDateTime(scheduledAtRaw);

  const subject = buildMeetingSubject(
    scheduledAt,
    "Opvolging",
    freshLead.firstName,
    freshLead.lastName
  );
  const notes = String(formData.get("notes") ?? "").trim() || null;

  const activity = await prisma.activity.create({
    data: {
      leadId,
      assigneeId: freshLead.ownerId,
      type: ActivityType.CALL,
      subject,
      notes,
      scheduledAt,
      durationMinutes: 30,
      status: ActivityStatus.PLANNED,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { lastContactedAt: new Date() },
  });

  // Wie dit terugbelmoment effectief inplant staat mee als deelnemer, tenzij
  // dat dezelfde persoon is als de eigenaar van de lead (zie scheduleActivityAction).
  const scheduledBy = await buildScheduledBy(user);
  await syncActivityToGoogleCalendar(
    assignee,
    activity,
    freshLead,
    null,
    scheduledBy,
    user.id === freshLead.ownerId
  );

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/funnel/${lead.leadType}`);
  revalidatePath("/pipeline/verkoop");
  revalidatePath("/pipeline/recrutering");
  revalidatePath("/taken");
  revalidatePath("/dashboard");
}
