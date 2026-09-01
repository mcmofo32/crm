"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { ActivityStatus, ActivityType, MeetingMode } from "@/generated/prisma/client";
import {
  canAccessOwner,
  canDeleteActivities,
  canManageCustomerData,
} from "@/lib/permissions";
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
  buildMeetingSubject,
} from "@/lib/meetingPlanning";
import { parseLocalDateTime, combineWithTimeOnSameLocalDay } from "@/lib/datetime";

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
  if (!canManageCustomerData(user)) {
    throw new Error("Enkel subagenten mogen een volgend gesprek inplannen");
  }

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
        ? String(formData.get("location") ?? "").trim() || null
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
      // Wie de afspraak effectief inplant staat altijd mee als deelnemer,
      // ook als dat dezelfde persoon is als de toegewezen gebruiker.
      const scheduledBy = await buildScheduledBy(user);
      await syncActivityToGoogleCalendar(assignee, activity, lead, subagent, scheduledBy);
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
 * Past een nog geplande afspraak aan (bv. datum/tijd verzetten, onderwerp of
 * notities wijzigen). Synchroniseert het bestaande Google Agenda-item mee.
 */
export async function updateActivityAction(
  activityId: string,
  formData: FormData
) {
  const activity = await prisma.activity.findUnique({
    where: { id: activityId },
  });
  if (!activity) throw new Error("Activiteit niet gevonden");
  if (activity.status !== ActivityStatus.PLANNED) {
    throw new Error("Enkel geplande afspraken kunnen aangepast worden");
  }
  const { user, lead } = await requireLeadAccess(activity.leadId);

  const feedback = String(formData.get("notes") ?? "").trim();
  if (!feedback) {
    throw new Error("Geef aan waarom deze afspraak gewijzigd wordt");
  }

  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "");
  const scheduledAt = scheduledAtRaw ? parseLocalDateTime(scheduledAtRaw) : activity.scheduledAt;

  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: {
      type: (formData.get("type") as ActivityType) ?? activity.type,
      subject: String(formData.get("subject") ?? activity.subject),
      notes: feedback,
      scheduledAt,
      durationMinutes: Number(
        formData.get("durationMinutes") ?? activity.durationMinutes ?? 15
      ),
    },
  });

  await logAudit({
    actorId: user.id,
    action: "activity.updated",
    entityType: "Activity",
    entityId: activityId,
    description: `Activiteit "${activity.subject}" bij lead "${lead.firstName} ${lead.lastName}" gewijzigd: ${feedback}`,
  });

  const assignee = await prisma.user.findUnique({
    where: { id: activity.assigneeId },
    select: GOOGLE_CALENDAR_USER_SELECT,
  });
  if (assignee && scheduledAt) {
    await syncActivityToGoogleCalendar(assignee, updated, lead);
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
    description: `Activiteit "${activity.subject}" verwijderd bij lead "${lead.firstName} ${lead.lastName}"`,
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
  await requireLeadAccess(activity.leadId);

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

  revalidatePath(`/leads/${activity.leadId}`);
  revalidatePath("/taken");
  revalidatePath("/dashboard");
}

/**
 * Plant meteen een afspraak (fysiek of online) in bij het verplaatsen van een
 * lead naar een "...ingepland"-fase (bv. Financiële analyse ingepland,
 * Adviesgesprek ingepland). Bij online zonder Google Meet wordt de eigen
 * Zoom-link van de toegewezen gebruiker (Instellingen) in de omschrijving
 * gezet; met Google Meet genereert Google zelf een meet-link op het
 * agenda-item.
 */
export async function planStageMeetingAction(leadId: string, formData: FormData) {
  const { user, lead } = await requireLeadAccess(leadId);

  const freshLead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { stage: true },
  });
  if (!freshLead) throw new Error("Lead niet gevonden");
  if (!isPlanningStage(freshLead.stage.label)) {
    throw new Error(
      "Een afspraak inplannen kan enkel in een '...ingepland'-fase"
    );
  }

  const assignee = await prisma.user.findUnique({
    where: { id: freshLead.ownerId },
    select: { zoomLink: true, ...GOOGLE_CALENDAR_USER_SELECT },
  });
  if (!assignee) throw new Error("Eigenaar van deze lead niet gevonden");

  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "");
  if (!scheduledAtRaw) throw new Error("Kies een datum en uur voor de afspraak");
  const scheduledAt = parseLocalDateTime(scheduledAtRaw);

  const endTimeRaw = String(formData.get("endTime") ?? "");
  if (!endTimeRaw) throw new Error("Kies een einduur voor de afspraak");
  const endAt = combineWithTimeOnSameLocalDay(scheduledAt, endTimeRaw);
  const durationMinutes = Math.round((endAt.getTime() - scheduledAt.getTime()) / 60_000);
  if (durationMinutes <= 0) {
    throw new Error("Het einduur moet na het startuur liggen");
  }

  const mode =
    formData.get("mode") === "ONLINE" ? MeetingMode.ONLINE : MeetingMode.ONSITE;
  const location =
    mode === MeetingMode.ONSITE
      ? String(formData.get("location") ?? "").trim() || null
      : null;
  const useGoogleMeet =
    mode === MeetingMode.ONLINE && formData.get("useGoogleMeet") === "on";

  let meetingLink: string | null = null;
  if (mode === MeetingMode.ONLINE && !useGoogleMeet) {
    meetingLink = assignee.zoomLink;
    if (!meetingLink) {
      throw new Error(
        "De eigenaar van deze lead heeft nog geen Zoom-link ingesteld bij Instellingen. Kies Google Meet, of vraag de eigenaar dit eerst in te stellen."
      );
    }
  }

  const subagentId = String(formData.get("subagentId") ?? "").trim() || null;
  const subagent = subagentId
    ? await prisma.subagent.findUnique({ where: { id: subagentId } })
    : null;
  if (subagentId && !subagent) throw new Error("Subagent niet gevonden");

  const subject = buildMeetingSubject(
    scheduledAt,
    freshLead.stage.label,
    freshLead.firstName,
    freshLead.lastName
  );

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
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { lastContactedAt: new Date() },
  });

  // Wie de afspraak effectief inplant staat altijd mee als deelnemer, ook
  // als dat dezelfde persoon is als de eigenaar van de lead.
  const scheduledBy = await buildScheduledBy(user);
  await syncActivityToGoogleCalendar(assignee, activity, freshLead, subagent, scheduledBy);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/funnel/${lead.leadType}`);
  revalidatePath("/taken");
  revalidatePath("/dashboard");
}

/**
 * Plant meteen een uitgaand telefoongesprek in bij het verplaatsen van een
 * lead naar de "Opvolging"-fase — een lichtere variant van
 * `planStageMeetingAction` (enkel datum/uur, geen fysiek/online/subagent),
 * die net als een afspraak automatisch in de Google Agenda van de eigenaar
 * komt te staan.
 */
export async function planFollowUpCallAction(leadId: string, formData: FormData) {
  const { user, lead } = await requireLeadAccess(leadId);

  const freshLead = await prisma.lead.findUnique({
    where: { id: leadId },
    include: { stage: true },
  });
  if (!freshLead) throw new Error("Lead niet gevonden");
  if (!isFollowUpStage(freshLead.stage.label)) {
    throw new Error(
      "Een terugbelmoment inplannen kan enkel in de fase 'Opvolging'"
    );
  }

  const assignee = await prisma.user.findUnique({
    where: { id: freshLead.ownerId },
    select: GOOGLE_CALENDAR_USER_SELECT,
  });
  if (!assignee) throw new Error("Eigenaar van deze lead niet gevonden");

  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "");
  if (!scheduledAtRaw) throw new Error("Kies een datum en uur voor het terugbelmoment");
  const scheduledAt = parseLocalDateTime(scheduledAtRaw);

  const subject = buildMeetingSubject(
    scheduledAt,
    "Opvolging",
    freshLead.firstName,
    freshLead.lastName
  );

  const activity = await prisma.activity.create({
    data: {
      leadId,
      assigneeId: freshLead.ownerId,
      type: ActivityType.CALL,
      subject,
      scheduledAt,
      durationMinutes: 30,
      status: ActivityStatus.PLANNED,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { lastContactedAt: new Date() },
  });

  const scheduledBy = await buildScheduledBy(user);
  await syncActivityToGoogleCalendar(assignee, activity, freshLead, null, scheduledBy);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/funnel/${lead.leadType}`);
  revalidatePath("/pipeline/verkoop");
  revalidatePath("/pipeline/recrutering");
  revalidatePath("/taken");
  revalidatePath("/dashboard");
}
