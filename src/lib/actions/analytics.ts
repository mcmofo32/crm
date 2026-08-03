import { prisma } from "@/lib/prisma";
import { isBeheerder } from "@/lib/permissions";
import { LeadStatus, LeadType, Role } from "@/generated/prisma/client";
import { getEffectiveViewer } from "@/lib/impersonation";

async function requireBeheerder() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!isBeheerder(viewer)) {
    throw new Error("Enkel de Beheerder heeft toegang tot deze analyse");
  }
  return viewer;
}

export type LeadTypeStats = {
  total: number;
  open: number;
  won: number;
  lost: number;
  conversionRate: number | null;
};

export type StageBucket = {
  leadType: LeadType;
  label: string;
  order: number;
  count: number;
};

export type EmployeeStats = {
  id: string;
  name: string;
  role: Role;
  teamId: string | null;
  teamName: string | null;
  totalLeads: number;
  won: number;
  lost: number;
  conversionRate: number | null;
  activitiesCompleted: number;
};

type EmployeeUser = {
  id: string;
  name: string;
  role: Role;
  team: { id: string; name: string } | null;
  coachedTeam: { id: string; name: string } | null;
};

function buildEmployeeStats(
  users: EmployeeUser[],
  leads: { ownerId: string; status: LeadStatus }[],
  activityGroups: { assigneeId: string; status: string; _count: { _all: number } }[]
): EmployeeStats[] {
  const completedActivitiesByUser = new Map<string, number>();
  for (const group of activityGroups) {
    if (group.status === "COMPLETED") {
      completedActivitiesByUser.set(
        group.assigneeId,
        (completedActivitiesByUser.get(group.assigneeId) ?? 0) +
          group._count._all
      );
    }
  }

  const leadStatsByOwner = new Map<
    string,
    { total: number; won: number; lost: number }
  >();
  for (const lead of leads) {
    const entry = leadStatsByOwner.get(lead.ownerId) ?? {
      total: 0,
      won: 0,
      lost: 0,
    };
    entry.total += 1;
    if (lead.status === "WON") entry.won += 1;
    if (lead.status === "LOST") entry.lost += 1;
    leadStatsByOwner.set(lead.ownerId, entry);
  }

  return users
    .map((u) => {
      const stats = leadStatsByOwner.get(u.id) ?? {
        total: 0,
        won: 0,
        lost: 0,
      };
      const decided = stats.won + stats.lost;
      const team = u.coachedTeam ?? u.team;
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        teamId: team?.id ?? null,
        teamName: team?.name ?? null,
        totalLeads: stats.total,
        won: stats.won,
        lost: stats.lost,
        conversionRate:
          decided > 0 ? Math.round((stats.won / decided) * 100) : null,
        activitiesCompleted: completedActivitiesByUser.get(u.id) ?? 0,
      };
    })
    .sort((a, b) => b.totalLeads - a.totalLeads);
}

export async function getAnalytics() {
  await requireBeheerder();

  const [leads, users, teams, activityGroups] = await Promise.all([
    prisma.lead.findMany({
      where: { deletedAt: null },
      select: {
        leadType: true,
        status: true,
        ownerId: true,
        stage: { select: { label: true, order: true } },
      },
    }),
    prisma.user.findMany({
      where: { active: true },
      select: {
        id: true,
        name: true,
        role: true,
        team: { select: { id: true, name: true } },
        coachedTeam: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.team.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.activity.groupBy({
      by: ["assigneeId", "status"],
      _count: { _all: true },
    }),
  ]);

  const byType: Record<LeadType, LeadTypeStats> = {
    FA: { total: 0, open: 0, won: 0, lost: 0, conversionRate: null },
    RG: { total: 0, open: 0, won: 0, lost: 0, conversionRate: null },
  };
  for (const lead of leads) {
    const bucket = byType[lead.leadType];
    bucket.total += 1;
    if (lead.status === "OPEN") bucket.open += 1;
    if (lead.status === "WON") bucket.won += 1;
    if (lead.status === "LOST") bucket.lost += 1;
  }
  for (const type of Object.keys(byType) as LeadType[]) {
    const bucket = byType[type];
    const decided = bucket.won + bucket.lost;
    bucket.conversionRate =
      decided > 0 ? Math.round((bucket.won / decided) * 100) : null;
  }

  const stageMap = new Map<string, StageBucket>();
  for (const lead of leads) {
    if (lead.status !== "OPEN") continue;
    const key = `${lead.leadType}:${lead.stage.label}`;
    const existing = stageMap.get(key);
    if (existing) {
      existing.count += 1;
    } else {
      stageMap.set(key, {
        leadType: lead.leadType,
        label: lead.stage.label,
        order: lead.stage.order,
        count: 1,
      });
    }
  }
  const stageDistribution = Array.from(stageMap.values()).sort(
    (a, b) => a.leadType.localeCompare(b.leadType) || a.order - b.order
  );

  const perEmployee = buildEmployeeStats(users, leads, activityGroups);

  return { byType, stageDistribution, perEmployee, teams };
}

/** Compact teamoverzicht voor een Coach: enkel zichzelf + zijn teamleden. */
export async function getTeamOverviewForCoach() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (viewer.role !== Role.COACH) {
    throw new Error("Enkel coaches hebben een teamoverzicht");
  }

  const team = await prisma.team.findUnique({
    where: { coachId: viewer.id },
    select: { id: true, name: true, members: { select: { id: true } } },
  });
  if (!team) return null;

  const userIds = [viewer.id, ...team.members.map((m) => m.id)];

  const [users, leads, activityGroups] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: {
        id: true,
        name: true,
        role: true,
        team: { select: { id: true, name: true } },
        coachedTeam: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    }),
    prisma.lead.findMany({
      where: { deletedAt: null, ownerId: { in: userIds } },
      select: { ownerId: true, status: true },
    }),
    prisma.activity.groupBy({
      by: ["assigneeId", "status"],
      where: { assigneeId: { in: userIds } },
      _count: { _all: true },
    }),
  ]);

  return {
    teamName: team.name,
    members: buildEmployeeStats(users, leads, activityGroups),
  };
}

export type TeamOverview = {
  teamId: string;
  teamName: string;
  coachName: string;
  members: EmployeeStats[];
};

/**
 * Alle teamoverzichten tegelijk, voor de Beheerder: dezelfde soort tabel die
 * een Coach voor zijn eigen team ziet, maar dan voor elke groep in het
 * bedrijf (bv. "Structuur A" van Thibault), in één keer op het dashboard.
 */
export async function getAllTeamOverviews(): Promise<TeamOverview[]> {
  await requireBeheerder();

  const teams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      coachId: true,
      coach: { select: { name: true } },
      members: { select: { id: true } },
    },
    orderBy: { name: "asc" },
  });
  if (teams.length === 0) return [];

  const allUserIds = Array.from(
    new Set(teams.flatMap((t) => [t.coachId, ...t.members.map((m) => m.id)]))
  );

  const [users, leads, activityGroups] = await Promise.all([
    prisma.user.findMany({
      where: { id: { in: allUserIds } },
      select: {
        id: true,
        name: true,
        role: true,
        team: { select: { id: true, name: true } },
        coachedTeam: { select: { id: true, name: true } },
      },
    }),
    prisma.lead.findMany({
      where: { deletedAt: null, ownerId: { in: allUserIds } },
      select: { ownerId: true, status: true },
    }),
    prisma.activity.groupBy({
      by: ["assigneeId", "status"],
      where: { assigneeId: { in: allUserIds } },
      _count: { _all: true },
    }),
  ]);

  const statsById = new Map(
    buildEmployeeStats(users, leads, activityGroups).map((s) => [s.id, s])
  );

  return teams.map((t) => ({
    teamId: t.id,
    teamName: t.name,
    coachName: t.coach.name,
    members: [t.coachId, ...t.members.map((m) => m.id)]
      .map((id) => statsById.get(id))
      .filter((s): s is EmployeeStats => Boolean(s)),
  }));
}
