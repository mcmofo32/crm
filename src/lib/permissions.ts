import { Role } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Rolhiërarchie voor dit CRM:
 *
 *  - BEHEERDER: alle rechten. Volledig systeembeheer (gebruikers, teams,
 *    funnels/instellingen, en alle leads/activiteiten van iedereen).
 *  - ADMIN: veel rechten. Ziet en beheert alle leads/activiteiten en kan
 *    gebruikers/teams beheren, maar mag geen Beheerder-accounts aanmaken,
 *    wijzigen of verwijderen, en heeft geen toegang tot systeeminstellingen.
 *  - COACH: toegang tot zichzelf + zijn team (de teamleden die aan hem/haar
 *    rapporteren).
 *  - USER: toegang enkel tot zichzelf.
 */

export type SessionUser = {
  id: string;
  role: Role;
};

export function isBeheerder(user: SessionUser) {
  return user.role === Role.BEHEERDER;
}

export function canManageSettings(user: SessionUser) {
  return user.role === Role.BEHEERDER;
}

export function canManageUsers(user: SessionUser) {
  return user.role === Role.BEHEERDER || user.role === Role.ADMIN;
}

/** Enkel de Beheerder mag leads definitief verwijderen. */
export function canDeleteLeads(user: SessionUser) {
  return user.role === Role.BEHEERDER;
}

/** Enkel de Beheerder mag activiteiten/afspraken definitief verwijderen (ongeacht status). */
export function canDeleteActivities(user: SessionUser) {
  return user.role === Role.BEHEERDER;
}

/** Wie mag incentive-events aanmaken/verwijderen? Iedereen mag ze bekijken. */
export function canManageIncentives(user: SessionUser) {
  return (
    user.role === Role.BEHEERDER ||
    user.role === Role.ADMIN ||
    user.role === Role.COACH
  );
}

/** Mag `actor` het account `target` aanmaken/wijzigen/verwijderen? */
export function canManageUser(actor: SessionUser, target: { role: Role }) {
  if (actor.role === Role.BEHEERDER) return true;
  if (actor.role === Role.ADMIN) return target.role !== Role.BEHEERDER;
  return false;
}

/**
 * Geeft de lijst van user-id's die de gegeven gebruiker mag zien/beheren
 * op basis van zijn rol. `null` betekent: geen beperking (alle gebruikers).
 */
export async function getVisibleUserIds(
  user: SessionUser
): Promise<string[] | null> {
  switch (user.role) {
    case Role.BEHEERDER:
    case Role.ADMIN:
      return null;
    case Role.COACH: {
      const team = await prisma.team.findUnique({
        where: { coachId: user.id },
        include: { members: { select: { id: true } } },
      });
      const memberIds = team?.members.map((m) => m.id) ?? [];
      return [user.id, ...memberIds];
    }
    case Role.USER:
    default:
      return [user.id];
  }
}

/** Prisma `where`-fragment om leads/activiteiten te beperken tot wat de gebruiker mag zien. */
export async function ownerScopeWhere(user: SessionUser) {
  const ids = await getVisibleUserIds(user);
  if (ids === null) return {};
  return { ownerId: { in: ids } };
}

export async function canAccessOwner(user: SessionUser, ownerId: string) {
  const ids = await getVisibleUserIds(user);
  if (ids === null) return true;
  return ids.includes(ownerId);
}
