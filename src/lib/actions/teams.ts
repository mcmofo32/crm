"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { canManageUsers, canManageUser } from "@/lib/permissions";

async function requireUserManager() {
  const session = await auth();
  if (!session?.user) throw new Error("Niet ingelogd");
  if (!canManageUsers(session.user)) {
    throw new Error("Je hebt geen rechten om teams te beheren");
  }
  return session.user;
}

export async function getTeamsWithMembers() {
  await requireUserManager();
  return prisma.team.findMany({
    include: {
      coach: { select: { id: true, name: true, email: true } },
      members: {
        select: { id: true, name: true, email: true },
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

/** Gebruikers (rol User) die als lid aan een team toegevoegd kunnen worden. */
export async function getMemberCandidates() {
  await requireUserManager();
  return prisma.user.findMany({
    where: { role: Role.USER, active: true },
    select: { id: true, name: true, email: true, teamId: true },
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

  await prisma.$transaction([
    prisma.team.create({ data: { name, coachId } }),
    prisma.user.update({
      where: { id: coachId },
      data: { role: Role.COACH, teamId: null },
    }),
  ]);

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
  if (!user || user.role !== Role.USER) {
    throw new Error(
      "Enkel gebruikers met rol 'User' kunnen aan een team toegevoegd worden"
    );
  }
  if (!canManageUser(actor, user)) {
    throw new Error("Je mag deze gebruiker niet beheren");
  }

  await prisma.user.update({ where: { id: userId }, data: { teamId } });

  revalidatePath("/beheer/teams");
  revalidatePath("/beheer/gebruikers");
}

export async function removeTeamMemberAction(teamId: string, userId: string) {
  await requireUserManager();

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user || user.teamId !== teamId) {
    throw new Error("Gebruiker zit niet in dit team");
  }

  await prisma.user.update({ where: { id: userId }, data: { teamId: null } });

  revalidatePath("/beheer/teams");
  revalidatePath("/beheer/gebruikers");
}
