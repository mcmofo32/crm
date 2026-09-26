"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
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
 * Subagenten om te kiezen bij het inplannen van een adviesgesprek. Een
 * adviesgesprek moet altijd samen met een subagent kunnen, dus iedereen ziet
 * hier alle actieve subagenten — niet enkel die van het eigen team.
 *
 * `includeCoaches` (default false, enkel voor de RG-planning-widget) telt
 * daar ook de auto-gesynchroniseerde coach-vermeldingen bij (zie
 * syncSubagentForUser) — voor recruteringsgesprekken mag naast een subagent
 * ook een coach uitgenodigd worden. Elke plek die dit niet expliciet
 * aanvraagt (dossierbeheerder-keuze, evenement-uitnodigingen,
 * Beheer > Teams) blijft ongewijzigd enkel "echte" subagenten tonen.
 */
export async function getSubagents(options?: { includeCoaches?: boolean }) {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  const includeCoaches = options?.includeCoaches ?? false;

  return prisma.subagent.findMany({
    where: {
      active: true,
      // Een auto-gesynchroniseerde subagent (gekoppeld aan een echt
      // gebruikersaccount, zie userId) mag nooit kiesbaar blijven als die
      // gebruiker ondertussen inactief gezet is — ook niet als
      // syncSubagentForUser dat om een of andere reden nog niet doorgevoerd
      // heeft. userId: null laat een manueel toegevoegde subagent (geen
      // inlogaccount, dus geen actief/inactief-status om op te controleren)
      // gewoon door. Type/rol wordt hier expliciet herbevestigd (i.p.v. enkel
      // op user.active te vertrouwen) omdat sinds includeCoaches een
      // gesynchroniseerd record ook enkel via role===COACH kan bestaan.
      OR: [
        { userId: null },
        { user: { active: true, agentType: "SUBAGENT" } },
        ...(includeCoaches
          ? [{ user: { active: true, role: "COACH" as const } }]
          : []),
      ],
    },
    include: {
      team: { select: { name: true } },
      user: { select: { role: true, agentType: true } },
    },
    orderBy: { name: "asc" },
  });
}

/**
 * Houdt het Subagent-record van deze gebruiker in sync met zijn "Type"
 * (agentType) én rol: is hij Subagent óf Coach, actief, heeft hij een
 * e-mailadres en een team, dan is/wordt hij automatisch kiesbaar bij het
 * uitnodigen van een subagent op een adviesgesprek (Subagent) of een coach op
 * een recruteringsgesprek (Coach, zie getSubagents' includeCoaches) — zonder
 * dat een aparte, manuele subagent-vermelding voor hem aangemaakt moet
 * worden.
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
      role: true,
      active: true,
      teamId: true,
      coachedTeam: { select: { id: true } },
    },
  });
  if (!user) return;

  const teamId = user.teamId ?? user.coachedTeam?.id ?? null;
  const qualifies =
    (user.agentType === "SUBAGENT" || user.role === "COACH") &&
    user.active &&
    !!user.email &&
    !!teamId;

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
