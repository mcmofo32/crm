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
  avatarUpdatedAt: Date | null;
  children: OrgNode[];
};

type Person = {
  id: string;
  name: string;
  role: Role;
  jobFunction: JobFunction | null;
  agentType: AgentType;
  avatarUpdatedAt: Date | null;
};

async function requireViewer() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  return viewer;
}

/**
 * Volledige bedrijfsstructuur, zichtbaar voor iedereen.
 *
 * Elke actieve gebruiker die ergens bij een team hoort krijgt precies één
 * plek in de boom, rechtstreeks bepaald door zijn eigen teamlidmaatschap:
 * is hij lid van een team, dan komt hij onder de coach van dàt team te
 * staan; heeft hij zelf geen team maar staat hij wel boven een team (bv.
 * de Beheerder), dan is hij zelf een rootnode. Wie noch een team heeft,
 * noch iemand onder zich (dus helemaal niet toegewezen), wordt niet
 * getoond — dat is meestal een niet-afgewerkte of dubbele account.
 *
 * Bewust géén indirecte opbouw via "doorloop alle teams, zoek voor elke
 * coach zijn team op, hou een gedeelde bezoekgeschiedenis bij" — dat bleek
 * in de praktijk gevoelig voor rand-gevallen (bv. iemand die zelf boven
 * aan de structuur staat). Elke persoon zoekt hier zelf, in één stap,
 * rechtstreeks zijn eigen ouder op.
 */
export async function getFullOrgChart(): Promise<OrgNode[]> {
  await requireViewer();

  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      role: true,
      jobFunction: true,
      agentType: true,
      avatarUpdatedAt: true,
      team: { select: { coachId: true } },
    },
    orderBy: { name: "asc" },
  });

  const peopleById = new Map<string, Person>(users.map((u) => [u.id, u]));
  const childIdsByParentId = new Map<string, string[]>();
  const rootIds: string[] = [];

  for (const user of users) {
    const parentId = user.team?.coachId ?? null;
    // Geen geldige ouder (niet ingevuld, verwijderd/inactief, of — in
    // theorie onmogelijk maar niet vertrouwen op één FK-veld — zichzelf)?
    // Dan staat deze persoon zelf aan de top i.p.v. te verdwijnen.
    if (parentId && parentId !== user.id && peopleById.has(parentId)) {
      const siblings = childIdsByParentId.get(parentId) ?? [];
      siblings.push(user.id);
      childIdsByParentId.set(parentId, siblings);
    } else {
      rootIds.push(user.id);
    }
  }

  /** `seen` voorkomt een oneindige lus bij een (foutieve) cirkel in de structuur. */
  function buildNode(id: string, seen: Set<string>): OrgNode {
    const person = peopleById.get(id)!;
    if (seen.has(id)) {
      return {
        id: person.id,
        name: person.name,
        role: person.role,
        jobFunction: person.jobFunction,
        agentType: person.agentType,
        avatarUpdatedAt: person.avatarUpdatedAt,
        children: [],
      };
    }
    seen.add(id);

    const childIds = childIdsByParentId.get(id) ?? [];
    return {
      id: person.id,
      name: person.name,
      role: person.role,
      jobFunction: person.jobFunction,
      agentType: person.agentType,
      avatarUpdatedAt: person.avatarUpdatedAt,
      children: childIds.map((childId) => buildNode(childId, seen)),
    };
  }

  const seen = new Set<string>();
  return rootIds
    .map((id) => buildNode(id, seen))
    .filter((node) => {
      // Een rootnode zonder eigen team én zonder team eronder (dus zonder
      // kinderen) is gewoon niet aan een team toegewezen — die hoort niet
      // in het organigram thuis. Iemand aan de top van een echte structuur
      // (bv. de Beheerder, met mensen onder zich) heeft wél kinderen en
      // blijft dus gewoon zichtbaar.
      return node.children.length > 0;
    });
}
