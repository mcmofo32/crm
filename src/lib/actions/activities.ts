"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ActivityStatus, ActivityType } from "@/generated/prisma/client";
import { canAccessOwner } from "@/lib/permissions";
import {
  deleteActivityFromGoogleCalendar,
  syncActivityToGoogleCalendar,
} from "@/lib/googleCalendar";
import { logAudit } from "@/lib/audit";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Niet ingelogd");
  return session.user;
}

async function requireLeadAccess(leadId: string) {
  const user = await requireUser();
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
  if (!(await canAccessOwner(user, lead.ownerId))) {
    throw new Error("Geen toegang tot deze lead");
  }
  return { user, lead };
}

/**
 * Plant een opvolgactiviteit (bv. een uitgaand telefoongesprek) in voor een
 * lead en zet ze automatisch in de Google Agenda van de toegewezen gebruiker.
 */
export async function scheduleActivityAction(formData: FormData) {
  const leadId = String(formData.get("leadId"));
  const { user, lead } = await requireLeadAccess(leadId);

  const assigneeId = String(formData.get("assigneeId") ?? user.id);
  if (!(await canAccessOwner(user, assigneeId))) {
    throw new Error("Je mag deze activiteit niet aan deze gebruiker toewijzen");
  }

  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "");
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;

  const activity = await prisma.activity.create({
    data: {
      leadId,
      assigneeId,
      type: (formData.get("type") as ActivityType) ?? ActivityType.CALL,
      subject: String(formData.get("subject") ?? "Telefoongesprek"),
      notes: (formData.get("notes") as string) || null,
      scheduledAt,
      durationMinutes: Number(formData.get("durationMinutes") ?? 15),
      status: ActivityStatus.PLANNED,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { lastContactedAt: new Date() },
  });

  if (scheduledAt) {
    const assignee = await prisma.user.findUnique({
      where: { id: assigneeId },
    });
    if (assignee) {
      await syncActivityToGoogleCalendar(assignee, activity, lead);
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
  const { user } = await requireLeadAccess(leadId);

  const assigneeId = String(formData.get("assigneeId") ?? user.id);
  if (!(await canAccessOwner(user, assigneeId))) {
    throw new Error("Je mag deze activiteit niet aan deze gebruiker toewijzen");
  }

  const occurredAtRaw = String(formData.get("occurredAt") ?? "");
  const occurredAt = occurredAtRaw ? new Date(occurredAtRaw) : new Date();

  await prisma.activity.create({
    data: {
      leadId,
      assigneeId,
      type: (formData.get("type") as ActivityType) ?? ActivityType.CALL,
      subject: String(formData.get("subject") ?? "Contact"),
      notes: (formData.get("notes") as string) || null,
      scheduledAt: occurredAt,
      completedAt: occurredAt,
      durationMinutes: Number(formData.get("durationMinutes") ?? 15),
      status: ActivityStatus.COMPLETED,
    },
  });

  await prisma.lead.update({
    where: { id: leadId },
    data: { lastContactedAt: occurredAt },
  });

  revalidatePath(`/leads/${leadId}`);
}

export async function completeActivityAction(
  activityId: string,
  notes?: string
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
    },
  });

  revalidatePath(`/leads/${activity.leadId}`);
  revalidatePath("/taken");
  revalidatePath("/dashboard");
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
  const { lead } = await requireLeadAccess(activity.leadId);

  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "");
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : activity.scheduledAt;

  const updated = await prisma.activity.update({
    where: { id: activityId },
    data: {
      type: (formData.get("type") as ActivityType) ?? activity.type,
      subject: String(formData.get("subject") ?? activity.subject),
      notes: (formData.get("notes") as string) || null,
      scheduledAt,
      durationMinutes: Number(
        formData.get("durationMinutes") ?? activity.durationMinutes ?? 15
      ),
    },
  });

  const assignee = await prisma.user.findUnique({
    where: { id: activity.assigneeId },
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

  const assignee = await prisma.user.findUnique({
    where: { id: activity.assigneeId },
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
