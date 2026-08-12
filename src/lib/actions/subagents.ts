"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { Role } from "@/generated/prisma/client";
import { canManageUsers } from "@/lib/permissions";
import { logAudit } from "@/lib/audit";
import { getEffectiveViewer } from "@/lib/impersonation";

async function requireUserManager() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canManageUsers(viewer)) {
    throw new Error("Je hebt geen rechten om subagenten te beheren");
  }
  return viewer;
}

/**
 * Subagenten om te kiezen bij het inplannen van een adviesgesprek, beperkt tot
 * de eigen structuur: Beheerder/Admin zien iedereen, Coach enkel het team dat
 * hij coacht, User enkel zijn eigen team.
 */
export async function getSubagents() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");

  if (viewer.role === Role.BEHEERDER || viewer.role === Role.ADMIN) {
    return prisma.subagent.findMany({
      where: { active: true },
      include: { team: { select: { name: true } } },
      orderBy: { name: "asc" },
    });
  }

  const user = await prisma.user.findUnique({
    where: { id: viewer.id },
    select: { teamId: true, coachedTeam: { select: { id: true } } },
  });
  const ownTeamId = user?.coachedTeam?.id ?? user?.teamId ?? null;
  if (!ownTeamId) return [];

  return prisma.subagent.findMany({
    where: { teamId: ownTeamId, active: true },
    include: { team: { select: { name: true } } },
    orderBy: { name: "asc" },
  });
}

/**
 * Houdt het Subagent-record van deze gebruiker in sync met zijn "Type"
 * (agentType): is hij Subagent, actief, heeft hij een e-mailadres en een
 * team, dan is/wordt hij automatisch kiesbaar bij het uitnodigen van een
 * subagent op een adviesgesprek — zonder dat een aparte, manuele
 * subagent-vermelding voor hem aangemaakt moet worden.
 *
 * Voldoet hij niet (meer), dan wordt het gekoppelde record enkel op
 * inactief gezet, nooit verwijderd — zo blijft de koppeling op reeds
 * ingeplande activiteiten/dossiers intact.
 */
export async function syncSubagentForUser(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      name: true,
      email: true,
      phone: true,
      agentType: true,
      active: true,
      teamId: true,
      coachedTeam: { select: { id: true } },
    },
  });
  if (!user) return;

  const teamId = user.teamId ?? user.coachedTeam?.id ?? null;
  const qualifies =
    user.agentType === "SUBAGENT" && user.active && !!user.email && !!teamId;

  if (!qualifies) {
    await prisma.subagent.updateMany({
      where: { userId: user.id, active: true },
      data: { active: false },
    });
    return;
  }

  await prisma.subagent.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      name: user.name,
      email: user.email!,
      phone: user.phone,
      teamId: teamId!,
      active: true,
    },
    update: {
      name: user.name,
      email: user.email!,
      phone: user.phone,
      teamId: teamId!,
      active: true,
    },
  });
}

/**
 * Haalt eenmalig alle bestaande gebruikers in (bv. wiens Type al vóór het
 * bestaan van deze automatische koppeling op Subagent stond) — nadien
 * houdt syncSubagentForUser dit vanzelf bij op elke aanmaak/wijziging.
 */
export async function syncAllSubagentsAction() {
  await requireUserManager();

  const users = await prisma.user.findMany({ select: { id: true } });
  await Promise.all(users.map((user) => syncSubagentForUser(user.id)));

  revalidatePath("/beheer/teams");
  revalidatePath("/beheer/gebruikers");
}

export async function deleteSubagentAction(subagentId: string) {
  const actor = await requireUserManager();

  const subagent = await prisma.subagent.findUnique({ where: { id: subagentId } });
  if (!subagent) throw new Error("Subagent niet gevonden");

  await prisma.subagent.delete({ where: { id: subagentId } });

  await logAudit({
    actorId: actor.id,
    action: "subagent.deleted",
    entityType: "Subagent",
    entityId: subagentId,
    description: `Subagent "${subagent.name}" verwijderd`,
  });

  revalidatePath("/beheer/teams");
}
