"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ActivityStatus,
  ActivityType,
  LeadStatus,
  LeadType,
} from "@/generated/prisma/client";
import { canAccessOwner, getVisibleUserIds } from "@/lib/permissions";

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Niet ingelogd");
  return session.user;
}

export async function createLeadAction(formData: FormData) {
  const user = await requireUser();

  const leadType = formData.get("leadType") as LeadType;
  const requestedOwnerId = String(formData.get("ownerId") ?? user.id);
  const ownerId = (await canAccessOwner(user, requestedOwnerId))
    ? requestedOwnerId
    : user.id;

  const firstStage = await prisma.funnelStage.findFirst({
    where: { leadType },
    orderBy: { order: "asc" },
  });
  if (!firstStage) {
    throw new Error(`Geen funnel-stages geconfigureerd voor ${leadType}`);
  }

  const lead = await prisma.lead.create({
    data: {
      firstName: String(formData.get("firstName") ?? ""),
      lastName: String(formData.get("lastName") ?? ""),
      email: (formData.get("email") as string) || null,
      phone: (formData.get("phone") as string) || null,
      company: (formData.get("company") as string) || null,
      source: (formData.get("source") as string) || null,
      notes: (formData.get("notes") as string) || null,
      leadType,
      ownerId,
      createdById: user.id,
      stageId: firstStage.id,
    },
  });

  revalidatePath("/leads");
  revalidatePath(`/funnel/${leadType}`);
  redirect(`/leads/${lead.id}`);
}

export async function updateLeadStageAction(
  leadId: string,
  toStageId: string,
  notes?: string
) {
  const user = await requireUser();

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead) throw new Error("Lead niet gevonden");
  if (!(await canAccessOwner(user, lead.ownerId))) {
    throw new Error("Geen toegang tot deze lead");
  }

  const toStage = await prisma.funnelStage.findUnique({
    where: { id: toStageId },
  });
  if (!toStage || toStage.leadType !== lead.leadType) {
    throw new Error("Ongeldige funnel-stage");
  }

  const status = toStage.isWon
    ? LeadStatus.WON
    : toStage.isLost
    ? LeadStatus.LOST
    : LeadStatus.OPEN;

  const trimmedNotes = notes?.trim();
  const now = new Date();

  await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: {
        stageId: toStageId,
        status,
        ...(trimmedNotes ? { lastContactedAt: now } : {}),
      },
    }),
    prisma.leadStageChange.create({
      data: {
        leadId,
        fromStageId: lead.stageId,
        toStageId,
        changedById: user.id,
      },
    }),
    ...(trimmedNotes
      ? [
          prisma.activity.create({
            data: {
              leadId,
              assigneeId: user.id,
              type: ActivityType.NOTE,
              status: ActivityStatus.COMPLETED,
              subject: `Verplaatst naar ${toStage.label}`,
              notes: trimmedNotes,
              scheduledAt: now,
              completedAt: now,
            },
          }),
        ]
      : []),
  ]);

  revalidatePath(`/leads/${leadId}`);
  revalidatePath(`/funnel/${lead.leadType}`);
  revalidatePath("/taken");
  revalidatePath("/dashboard");
}

export async function getLeadsForCurrentUser(leadType?: LeadType) {
  const user = await requireUser();
  const ids = await getVisibleUserIds(user);

  return prisma.lead.findMany({
    where: {
      ...(ids ? { ownerId: { in: ids } } : {}),
      ...(leadType ? { leadType } : {}),
    },
    include: { stage: true, owner: true },
    orderBy: { createdAt: "desc" },
  });
}

export async function getAssignableUsers() {
  const user = await requireUser();
  const ids = await getVisibleUserIds(user);
  return prisma.user.findMany({
    where: ids ? { id: { in: ids } } : {},
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
