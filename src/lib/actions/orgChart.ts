"use server";

import { prisma } from "@/lib/prisma";
import { AgentType, JobFunction, Role } from "@/generated/prisma/client";
import { getEffectiveViewer } from "@/lib/impersonation";

export type OrgNode = {
  id: string;
  name: string;
  role: Role;
  jobFunction: JobFunction | null;
  agentType: AgentType;
  children: OrgNode[];
};

type Person = {
  id: string;
  name: string;
  role: Role;
  jobFunction: JobFunction | null;
  agentType: AgentType;
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
    agentType: true,
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
      agentType: person.agentType,
      children: [],
    };
  }
  seen.add(person.id);

  return {
    id: person.id,
    name: person.name,
    role: person.role,
    jobFunction: person.jobFunction,
    agentType: person.agentType,
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

/** Volledige bedrijfsstructuur, zichtbaar voor iedereen: elke top-coach als apart rootnode. */
export async function getFullOrgChart(): Promise<OrgNode[]> {
  await requireViewer();

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
