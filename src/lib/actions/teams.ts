"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import {
  canManageUsers,
  canManageUser,
  wouldCreateCoachCycle,
  getDescendantUserIds,
} from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { getEffectiveViewer } from "@/lib/impersonation";

async function requireUserManager() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canManageUsers(viewer)) {
    throw new Error("Je hebt geen rechten om teams te beheren");
  }
  return viewer;
}

export async function getTeamsWithMembers() {
  await requireUserManager();
  return prisma.team.findMany({
    include: {
      coach: { select: { id: true, name: true, email: true, teamId: true } },
      members: {
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

/** Gebruikers die als coach van een NIEUW team aangeduid kunnen worden. */
export async function getCoachCandidates() {
  await requireUserManager();
  return prisma.user.findMany({
    where: { coachedTeam: null, role: { not: Role.BEHEERDER }, active: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
}

/**
 * Gebruikers die de coach van een BESTAAND team kunnen vervangen: dezelfde
 * voorwaarden als een nieuwe coach, maar exclusief de huidige coach zelf en
 * exclusief iedereen die nu al onder dit team valt (anders ontstaat een
 * cirkel: de nieuwe coach zou dan onder zichzelf komen te staan).
 */
export async function getCoachChangeCandidates(teamId: string) {
  await requireUserManager();
  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) return [];

  const descendantIds = await getDescendantUserIds(team.coachId);
  const candidates = await prisma.user.findMany({
    where: { coachedTeam: null, role: { not: Role.BEHEERDER }, active: true },
    select: { id: true, name: true, email: true, role: true },
    orderBy: { name: "asc" },
  });
  return candidates.filter(
    (c) => c.id !== team.coachId && !descendantIds.includes(c.id)
  );
}

/**
 * Gebruikers die als lid aan een team toegevoegd kunnen worden: rol User
 * (gewoon teamlid), of rol Coach (zo rapporteert die coach op zijn beurt aan
 * de coach van dit team — dit is hoe een meerlaagse structuur ontstaat).
 */
export async function getMemberCandidates() {
  await requireUserManager();
  return prisma.user.findMany({
    where: { role: { in: [Role.USER, Role.COACH] }, active: true },
    select: { id: true, name: true, email: true, teamId: true, role: true },
    orderBy: { name: "asc" },
  });
}

export async function createTeamAction(formData: FormData) {
  const actor = await requireUserManager();

  const name = String(formData.get("name") ?? "").trim();
  const coachId = String(formData.get("coachId") ?? "");
  if (!name || !coachId) {
    throw new Error("Naam en coach zijn verplicht");
  }

  const coach = await prisma.user.findUnique({
    where: { id: coachId },
    include: { coachedTeam: true },
  });
  if (!coach) throw new Error("Coach niet gevonden");
  if (!canManageUser(actor, coach)) {
    throw new Error("Je mag deze gebruiker niet als coach aanduiden");
  }
  if (coach.coachedTeam) {
    throw new Error("Deze gebruiker leidt al een team");
  }

  const [team] = await prisma.$transaction([
    prisma.team.create({ data: { name, coachId } }),
    prisma.user.update({
      where: { id: coachId },
      data: { role: Role.COACH, teamId: null },
    }),
  ]);

  await logAudit({
    actorId: actor.id,
    action: "team.created",
    entityType: "Team",
    entityId: team.id,
    description: `Team "${name}" aangemaakt met coach "${coach.name}"`,
  });

  revalidatePath("/beheer/teams");
  revalidatePath("/beheer/gebruikers");
}

export async function addTeamMemberAction(teamId: string, formData: FormData) {
  const actor = await requireUserManager();

  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Kies een gebruiker");

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team niet gevonden");

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || (user.role !== Role.USER && user.role !== Role.COACH)) {
    throw new Error(
      "Enkel gebruikers met rol 'User' of 'Coach' kunnen aan een team toegevoegd worden"
    );
  }
  if (!canManageUser(actor, user)) {
    throw new Error("Je mag deze gebruiker niet beheren");
  }
  if (user.role === Role.COACH && (await wouldCreateCoachCycle(userId, team.coachId))) {
    throw new Error(
      "Dit zou een cirkel in de structuur veroorzaken (deze coach zit al boven de coach van dit team)"
    );
  }

  await prisma.user.update({ where: { id: userId }, data: { teamId } });

  await logAudit({
    actorId: actor.id,
    action: "team.member_added",
    entityType: "Team",
    entityId: team.id,
    description: `"${user.name}" toegevoegd aan team "${team.name}"`,
  });

  revalidatePath("/beheer/teams");
  revalidatePath("/beheer/gebruikers");
}

/** Vervangt de coach van een bestaand team door een andere gebruiker. */
export async function changeTeamCoachAction(teamId: string, formData: FormData) {
  const actor = await requireUserManager();

  const newCoachId = String(formData.get("coachId") ?? "");
  if (!newCoachId) throw new Error("Kies een nieuwe coach");

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team niet gevonden");
  if (newCoachId === team.coachId) return;

  const newCoach = await prisma.user.findUnique({
    where: { id: newCoachId },
    include: { coachedTeam: true },
  });
  if (!newCoach) throw new Error("Gebruiker niet gevonden");
  if (!canManageUser(actor, newCoach)) {
    throw new Error("Je mag deze gebruiker niet als coach aanduiden");
  }
  if (newCoach.coachedTeam) {
    throw new Error("Deze gebruiker leidt al een ander team");
  }

  const descendantIds = await getDescendantUserIds(team.coachId);
  if (descendantIds.includes(newCoachId)) {
    throw new Error(
      "Dit zou een cirkel in de structuur veroorzaken (deze gebruiker zit al onder dit team)"
    );
  }

  await prisma.$transaction([
    prisma.team.update({ where: { id: teamId }, data: { coachId: newCoachId } }),
    prisma.user.update({
      where: { id: newCoachId },
      data: { role: Role.COACH, teamId: null },
    }),
  ]);

  await logAudit({
    actorId: actor.id,
    action: "team.coach_changed",
    entityType: "Team",
    entityId: teamId,
    description: `Coach van team "${team.name}" gewijzigd naar "${newCoach.name}"`,
  });

  revalidatePath("/beheer/teams");
  revalidatePath("/beheer/gebruikers");
  revalidatePath("/organigram");
}

/**
 * Verwijdert een team volledig. Teamleden (en een eventuele sub-coach met
 * zijn hele structuur) worden losgekoppeld, niet mee verwijderd — ze
 * hebben nadien gewoon geen team meer tot ze opnieuw ingedeeld worden.
 */
export async function deleteTeamAction(teamId: string) {
  const actor = await requireUserManager();

  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: { members: true },
  });
  if (!team) throw new Error("Team niet gevonden");

  await prisma.$transaction([
    prisma.user.updateMany({ where: { teamId }, data: { teamId: null } }),
    prisma.team.delete({ where: { id: teamId } }),
  ]);

  await logAudit({
    actorId: actor.id,
    action: "team.deleted",
    entityType: "Team",
    entityId: teamId,
    description: `Team "${team.name}" verwijderd (${team.members.length} teamleden losgekoppeld)`,
  });

  revalidatePath("/beheer/teams");
  revalidatePath("/beheer/gebruikers");
  revalidatePath("/organigram");
}

export async function removeTeamMemberAction(teamId: string, userId: string) {
  const actor = await requireUserManager();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.teamId !== teamId) {
    throw new Error("Gebruiker zit niet in dit team");
  }
  const team = await prisma.team.findUnique({ where: { id: teamId } });

  await prisma.user.update({ where: { id: userId }, data: { teamId: null } });

  await logAudit({
    actorId: actor.id,
    action: "team.member_removed",
    entityType: "Team",
    entityId: teamId,
    description: `"${user.name}" verwijderd uit team "${team?.name ?? teamId}"`,
  });

  revalidatePath("/beheer/teams");
  revalidatePath("/beheer/gebruikers");
}
