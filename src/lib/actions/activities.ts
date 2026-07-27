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

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Niet ingelogd");
  return session.user;
}

async function requireLeadAccess(leadId: string) {
  const user = await requireUser();
  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead niet gevonden");
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
}
