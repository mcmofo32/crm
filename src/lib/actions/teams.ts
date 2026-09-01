"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import {
  canManageUsers,
  canEditAccount,
  canChangeRole,
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
        where: { deletedAt: null },
        select: { id: true, name: true, email: true, role: true },
        orderBy: { name: "asc" },
      },
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Alle actieve gebruikers, in bulk — dit is de enige databasetoegang die
 * nodig is om (samen met getTeamsWithMembers en getSubagents) alle
 * kandidatenlijsten op de Teams-pagina in het geheugen te berekenen via
 * TeamPlanningContext, in plaats van per team-kaartje of teamlid telkens
 * opnieuw de database te bevragen.
 */
export async function getAllActiveUsersForPlanning() {
  await requireUserManager();
  return prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, email: true, role: true, teamId: true },
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
    select: { role: true, name: true, coachedTeam: { select: { id: true } } },
  });
  if (!coach) throw new Error("Coach niet gevonden");
  if (!canChangeRole(actor, coach, Role.COACH)) {
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, name: true },
  });
  if (!user) throw new Error("Gebruiker niet gevonden");
  if (!canEditAccount(actor, user)) {
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
  revalidatePath("/organigram");
}

/**
 * Plaatst een gebruiker rechtstreeks onder een andere persoon, ongeacht of
 * die persoon al coach is. Is hij dat nog niet, dan wordt hij dat nu
 * automatisch (met een eigen team) — dat is precies wat er anders manueel
 * via "Nieuw team aanmaken" + "Toevoegen" moest gebeuren. Zo kan je recht
 * op de naam van iemand doorbouwen: onder Jeroen, dan onder zijn
 * medewerkers, enzovoort.
 */
export async function addSubordinateAction(personId: string, formData: FormData) {
  const actor = await requireUserManager();

  const userId = String(formData.get("userId") ?? "");
  if (!userId) throw new Error("Kies een gebruiker");
  if (userId === personId) {
    throw new Error("Je kan iemand niet onder zichzelf plaatsen");
  }

  const person = await prisma.user.findUnique({
    where: { id: personId },
    select: { role: true, name: true, coachedTeam: { select: { id: true } } },
  });
  if (!person) throw new Error("Gebruiker niet gevonden");
  if (!canEditAccount(actor, person)) {
    throw new Error("Je mag deze gebruiker niet beheren");
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true, name: true },
  });
  if (!user) throw new Error("Gebruiker niet gevonden");
  if (!canEditAccount(actor, user)) {
    throw new Error("Je mag deze gebruiker niet beheren");
  }
  if (user.role === Role.COACH && (await wouldCreateCoachCycle(userId, personId))) {
    throw new Error(
      "Dit zou een cirkel in de structuur veroorzaken (deze coach zit al boven deze persoon)"
    );
  }

  let team = person.coachedTeam;
  if (!team) {
    // Enkel een gewone USER wordt hier automatisch Coach; een Admin/Beheerder
    // die nog geen eigen team had, behoudt zijn rol (kan ook een team hebben,
    // zie ook canEditAccount) i.p.v. gedegradeerd te worden naar Coach.
    if (person.role === Role.USER) {
      const [newTeam] = await prisma.$transaction([
        prisma.team.create({ data: { name: `Team ${person.name}`, coachId: personId } }),
        prisma.user.update({ where: { id: personId }, data: { role: Role.COACH } }),
      ]);
      team = newTeam;
    } else {
      team = await prisma.team.create({
        data: { name: `Team ${person.name}`, coachId: personId },
      });
    }
  }

  await prisma.user.update({ where: { id: userId }, data: { teamId: team.id } });

  await logAudit({
    actorId: actor.id,
    action: "team.member_added",
    entityType: "Team",
    entityId: team.id,
    description: `"${user.name}" toegevoegd onder "${person.name}"`,
  });

  revalidatePath("/beheer/teams");
  revalidatePath("/beheer/gebruikers");
  revalidatePath("/organigram");
}

/** Hernoemt een bestaand team. */
export async function renameTeamAction(teamId: string, formData: FormData) {
  const actor = await requireUserManager();

  const name = String(formData.get("name") ?? "").trim();
  if (!name) throw new Error("Naam is verplicht");

  const team = await prisma.team.findUnique({ where: { id: teamId } });
  if (!team) throw new Error("Team niet gevonden");
  if (name === team.name) return;

  await prisma.team.update({ where: { id: teamId }, data: { name } });

  await logAudit({
    actorId: actor.id,
    action: "team.renamed",
    entityType: "Team",
    entityId: teamId,
    description: `Team "${team.name}" hernoemd naar "${name}"`,
  });

  revalidatePath("/beheer/teams");
  revalidatePath("/beheer/gebruikers");
  revalidatePath("/organigram");
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
    select: {
      role: true,
      name: true,
      coachedTeam: {
        select: {
          id: true,
          _count: { select: { members: true, subagents: true } },
        },
      },
    },
  });
  if (!newCoach) throw new Error("Gebruiker niet gevonden");
  if (!canChangeRole(actor, newCoach, Role.COACH)) {
    throw new Error("Je mag deze gebruiker niet als coach aanduiden");
  }
  // Een kandidaat die zelf al coach is van een eigen team mag enkel gekozen
  // worden als dat team nog helemaal leeg is (bv. automatisch aangemaakt bij
  // het toekennen van de rol Coach) — dat team wordt dan mee opgeruimd.
  // Anders zouden zijn bestaande teamleden/subagenten wees worden.
  if (
    newCoach.coachedTeam &&
    (newCoach.coachedTeam._count.members > 0 ||
      newCoach.coachedTeam._count.subagents > 0)
  ) {
    throw new Error("Deze gebruiker leidt al een ander team");
  }

  const descendantIds = await getDescendantUserIds(team.coachId);
  if (descendantIds.includes(newCoachId)) {
    throw new Error(
      "Dit zou een cirkel in de structuur veroorzaken (deze gebruiker zit al onder dit team)"
    );
  }

  await prisma.$transaction([
    ...(newCoach.coachedTeam
      ? [prisma.team.delete({ where: { id: newCoach.coachedTeam.id } })]
      : []),
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

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { teamId: true, name: true },
  });
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
  revalidatePath("/organigram");
}
