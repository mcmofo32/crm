"use server";

import { prisma } from "@/lib/prisma";
import { JobFunction, Role } from "@/generated/prisma/client";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageUsers } from "@/lib/permissions";

export type OrgNode = {
  id: string;
  name: string;
  role: Role;
  jobFunction: JobFunction | null;
  isSubagent: boolean;
  children: OrgNode[];
};

type Person = {
  id: string;
  name: string;
  role: Role;
  jobFunction: JobFunction | null;
  isSubagent: boolean;
  active: boolean;
};

type TeamWithPeople = {
  id: string;
  name: string;
  coachId: string;
  coach: Person;
  members: Person[];
};

async function requireViewer() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  return viewer;
}

async function loadAllTeams(): Promise<TeamWithPeople[]> {
  const personSelect = {
    id: true,
    name: true,
    role: true,
    jobFunction: true,
    isSubagent: true,
    active: true,
  } as const;
  return prisma.team.findMany({
    include: {
      coach: { select: personSelect },
      members: { select: personSelect },
    },
  });
}

/** `seen` voorkomt een oneindige lus bij een (foutieve) cirkel in de structuur. */
function buildNode(
  teamByCoachId: Map<string, TeamWithPeople>,
  person: Person,
  seen: Set<string>
): OrgNode {
  if (seen.has(person.id)) {
    return {
      id: person.id,
      name: person.name,
      role: person.role,
      jobFunction: person.jobFunction,
      isSubagent: person.isSubagent,
      children: [],
    };
  }
  seen.add(person.id);

  return {
    id: person.id,
    name: person.name,
    role: person.role,
    jobFunction: person.jobFunction,
    isSubagent: person.isSubagent,
    children: buildActiveChildren(teamByCoachId, person, seen),
  };
}

/**
 * Bouwt de kinderen van `person`, met inactieve gebruikers overgeslagen.
 * Is een teamlid zelf inactief maar coacht die nog een eigen (deels actief)
 * team, dan komen diens actieve mensen rechtstreeks als kind van `person`
 * te staan i.p.v. helemaal te verdwijnen.
 */
function buildActiveChildren(
  teamByCoachId: Map<string, TeamWithPeople>,
  person: Person,
  seen: Set<string>
): OrgNode[] {
  const team = teamByCoachId.get(person.id);
  if (!team) return [];

  const children: OrgNode[] = [];
  for (const member of team.members) {
    if (seen.has(member.id)) continue;
    if (member.active) {
      children.push(buildNode(teamByCoachId, member, seen));
    } else {
      seen.add(member.id);
      children.push(...buildActiveChildren(teamByCoachId, member, seen));
    }
  }
  return children;
}

/** Volledige bedrijfsstructuur (enkel Beheerder/Admin): elke top-coach als apart rootnode. */
export async function getFullOrgChart(): Promise<OrgNode[]> {
  const viewer = await requireViewer();
  if (!canManageUsers(viewer)) {
    throw new Error("Je hebt geen rechten om het volledige organigram te bekijken");
  }

  const teams = await loadAllTeams();
  const teamByCoachId = new Map(teams.map((t) => [t.coachId, t]));
  const memberIds = new Set(teams.flatMap((t) => t.members.map((m) => m.id)));

  // Root = een coach die zelf nergens teamlid van is (staat aan de top van zijn keten).
  const roots = teams.filter((t) => !memberIds.has(t.coachId));
  const seen = new Set<string>();
  const result: OrgNode[] = [];
  for (const t of roots) {
    if (t.coach.active) {
      result.push(buildNode(teamByCoachId, t.coach, seen));
    } else {
      // Inactieve top-coach: zelf niet tonen, maar actieve mensen in zijn
      // structuur alsnog als eigen rootnodes tonen i.p.v. laten verdwijnen.
      seen.add(t.coach.id);
      result.push(...buildActiveChildren(teamByCoachId, t.coach, seen));
    }
  }
  return result;
}

/** Eigen structuur van een Coach: zichzelf als root, plus wie zijn eigen coach is (indien van toepassing). */
export async function getMyOrgChart(): Promise<{
  upline: { id: string; name: string } | null;
  tree: OrgNode;
}> {
  const viewer = await requireViewer();
  if (viewer.role !== Role.COACH) {
    throw new Error("Enkel coaches hebben een eigen structuur");
  }

  const [teams, me] = await Promise.all([
    loadAllTeams(),
    prisma.user.findUnique({
      where: { id: viewer.id },
      select: {
        id: true,
        name: true,
        role: true,
        jobFunction: true,
        isSubagent: true,
        active: true,
        team: { select: { coach: { select: { id: true, name: true } } } },
      },
    }),
  ]);
  if (!me) throw new Error("Gebruiker niet gevonden");

  const teamByCoachId = new Map(teams.map((t) => [t.coachId, t]));
  const seen = new Set<string>();
  const tree = buildNode(teamByCoachId, me, seen);

  return {
    upline: me.team?.coach ? { id: me.team.coach.id, name: me.team.coach.name } : null,
    tree,
  };
}
