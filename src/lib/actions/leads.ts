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
import {
  canAccessOwner,
  canDeleteLeads,
  getVisibleUserIds,
} from "@/lib/permissions";
import { logAudit } from "@/lib/audit";

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

  await logAudit({
    actorId: user.id,
    action: "lead.created",
    entityType: "Lead",
    entityId: lead.id,
    description: `Lead "${lead.firstName} ${lead.lastName}" aangemaakt (${leadType})`,
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
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");
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

/** Verwijdert een lead (soft delete): ze komt in de prullenbak i.p.v. definitief weg te zijn. */
export async function deleteLeadAction(leadId: string) {
  const user = await requireUser();
  if (!canDeleteLeads(user)) {
    throw new Error("Je mag geen leads verwijderen");
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || lead.deletedAt) throw new Error("Lead niet gevonden");

  await prisma.lead.update({
    where: { id: leadId },
    data: { deletedAt: new Date(), deletedById: user.id },
  });

  await logAudit({
    actorId: user.id,
    action: "lead.deleted",
    entityType: "Lead",
    entityId: lead.id,
    description: `Lead "${lead.firstName} ${lead.lastName}" verwijderd (naar prullenbak)`,
  });

  revalidatePath("/leads");
  revalidatePath(`/funnel/${lead.leadType}`);
  revalidatePath("/taken");
  revalidatePath("/dashboard");
  revalidatePath("/beheer/prullenbak");
}

/** Haalt een lead terug uit de prullenbak. */
export async function restoreLeadAction(leadId: string) {
  const user = await requireUser();
  if (!canDeleteLeads(user)) {
    throw new Error("Je mag geen leads herstellen");
  }

  const lead = await prisma.lead.findUnique({ where: { id: leadId } });
  if (!lead || !lead.deletedAt) throw new Error("Lead niet gevonden in prullenbak");

  await prisma.lead.update({
    where: { id: leadId },
    data: { deletedAt: null, deletedById: null },
  });

  await logAudit({
    actorId: user.id,
    action: "lead.restored",
    entityType: "Lead",
    entityId: lead.id,
    description: `Lead "${lead.firstName} ${lead.lastName}" hersteld uit de prullenbak`,
  });

  revalidatePath("/leads");
  revalidatePath(`/funnel/${lead.leadType}`);
  revalidatePath("/beheer/prullenbak");
}

/** Lijst van verwijderde leads voor de prullenbak-pagina (enkel Beheerder). */
export async function getDeletedLeads() {
  const user = await requireUser();
  if (!canDeleteLeads(user)) {
    throw new Error("Je hebt geen toegang tot de prullenbak");
  }

  return prisma.lead.findMany({
    where: { deletedAt: { not: null } },
    include: { owner: true, deletedBy: true },
    orderBy: { deletedAt: "desc" },
  });
}

export async function getLeadsForCurrentUser(
  leadType?: LeadType,
  search?: string
) {
  const user = await requireUser();
  const ids = await getVisibleUserIds(user);
  const trimmedSearch = search?.trim();

  return prisma.lead.findMany({
    where: {
      deletedAt: null,
      ...(ids ? { ownerId: { in: ids } } : {}),
      ...(leadType ? { leadType } : {}),
      ...(trimmedSearch
        ? {
            OR: [
              { firstName: { contains: trimmedSearch, mode: "insensitive" } },
              { lastName: { contains: trimmedSearch, mode: "insensitive" } },
              { email: { contains: trimmedSearch, mode: "insensitive" } },
              { phone: { contains: trimmedSearch, mode: "insensitive" } },
              { company: { contains: trimmedSearch, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: {
      stage: true,
      owner: true,
      activities: {
        where: { status: "PLANNED", scheduledAt: { gte: new Date() } },
        orderBy: { scheduledAt: "asc" },
        take: 1,
        select: { scheduledAt: true },
      },
    },
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
