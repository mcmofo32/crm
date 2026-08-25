"use server";

import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canViewBeheerderTools } from "@/lib/permissions";
import { LeadType } from "@/generated/prisma/client";
import { funnelStageKeys } from "@/lib/funnelStages";

async function requireReportAccess() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canViewBeheerderTools(viewer)) {
    throw new Error("Enkel Beheerder/Admin hebben toegang tot het dagrapport");
  }
  return viewer;
}

function dayRange(date: Date) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(end.getDate() + 1);
  return { start, end };
}

export type DailyStageColumn = { key: string; label: string };
export type DailyStageFlowRow = {
  teamName: string;
  /** Aantal leads dat deze dag naar elke fase verhuisde, per stage-key (zie `columns`). */
  counts: Record<string, number>;
  total: number;
};
export type DailyPersonStageFlowRow = {
  userId: string;
  name: string;
  teamName: string;
  counts: Record<string, number>;
  total: number;
};
export type DailyStageFlow = {
  columns: DailyStageColumn[];
  /** Per team van de lead-eigenaar (zelfde indeling als Analyse/Productie elders in de app). */
  rows: DailyStageFlowRow[];
  /**
   * Per persoon die de wijziging effectief uitvoerde (`changedBy`) — dat kan
   * afwijken van de lead-eigenaar (bv. een coach die voor een teamlid een
   * fase wijzigt), en is dus een ander overzicht dan `rows` hierboven.
   */
  byPerson: DailyPersonStageFlowRow[];
};

export type DailyReport = {
  periodStart: Date;
  periodEnd: Date;
  fa: DailyStageFlow;
  rg: DailyStageFlow;
};

async function buildStageFlow(
  leadType: LeadType,
  changes: {
    toStage: { key: string };
    lead: { owner: { name: string; teamName: string | null } };
    changedBy: { id: string; name: string; teamName: string | null };
  }[]
): Promise<DailyStageFlow> {
  const stages = await prisma.funnelStage.findMany({
    where: { leadType, key: { in: funnelStageKeys(leadType) } },
    orderBy: { order: "asc" },
    select: { key: true, label: true },
  });
  const columns = stages.map((s) => ({ key: s.key, label: s.label }));

  const byTeam = new Map<string, Record<string, number>>();
  for (const c of changes) {
    const teamName = c.lead.owner.teamName ?? "Geen team";
    const counts = byTeam.get(teamName) ?? {};
    counts[c.toStage.key] = (counts[c.toStage.key] ?? 0) + 1;
    byTeam.set(teamName, counts);
  }

  const rows = Array.from(byTeam.entries())
    .map(([teamName, counts]) => ({
      teamName,
      counts,
      total: Object.values(counts).reduce((s, n) => s + n, 0),
    }))
    .sort((a, b) => b.total - a.total || a.teamName.localeCompare(b.teamName));

  const byPersonMap = new Map<
    string,
    { name: string; teamName: string; counts: Record<string, number> }
  >();
  for (const c of changes) {
    const entry = byPersonMap.get(c.changedBy.id) ?? {
      name: c.changedBy.name,
      teamName: c.changedBy.teamName ?? "Geen team",
      counts: {},
    };
    entry.counts[c.toStage.key] = (entry.counts[c.toStage.key] ?? 0) + 1;
    byPersonMap.set(c.changedBy.id, entry);
  }

  const byPerson = Array.from(byPersonMap.entries())
    .map(([userId, entry]) => ({
      userId,
      name: entry.name,
      teamName: entry.teamName,
      counts: entry.counts,
      total: Object.values(entry.counts).reduce((s, n) => s + n, 0),
    }))
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));

  return { columns, rows, byPerson };
}

/**
 * Dagrapport: per team, hoeveel leads op de gekozen dag naar elke
 * funnel-fase verhuisden (bv. hoeveel nieuwe FA's ingepland, hoeveel
 * doorgestroomd naar Adviesgesprek, hoeveel Klant/Geen klant geworden).
 * Standaard gisteren, maar elke dag is op te vragen.
 */
export async function getDailyStageReport(date: Date): Promise<DailyReport> {
  await requireReportAccess();
  const { start, end } = dayRange(date);

  const changes = await prisma.leadStageChange.findMany({
    where: { changedAt: { gte: start, lt: end }, lead: { deletedAt: null } },
    select: {
      toStage: { select: { key: true } },
      lead: {
        select: {
          leadType: true,
          owner: {
            select: {
              name: true,
              team: { select: { name: true } },
              coachedTeam: { select: { name: true } },
            },
          },
        },
      },
      changedBy: {
        select: {
          id: true,
          name: true,
          team: { select: { name: true } },
          coachedTeam: { select: { name: true } },
        },
      },
    },
  });

  const withTeamName = changes.map((c) => ({
    toStage: c.toStage,
    lead: {
      leadType: c.lead.leadType,
      owner: {
        name: c.lead.owner.name,
        teamName: c.lead.owner.team?.name ?? c.lead.owner.coachedTeam?.name ?? null,
      },
    },
    changedBy: {
      id: c.changedBy.id,
      name: c.changedBy.name,
      teamName: c.changedBy.team?.name ?? c.changedBy.coachedTeam?.name ?? null,
    },
  }));

  const [fa, rg] = await Promise.all([
    buildStageFlow(
      "FA",
      withTeamName.filter((c) => c.lead.leadType === "FA")
    ),
    buildStageFlow(
      "RG",
      withTeamName.filter((c) => c.lead.leadType === "RG")
    ),
  ]);

  return { periodStart: start, periodEnd: end, fa, rg };
}
