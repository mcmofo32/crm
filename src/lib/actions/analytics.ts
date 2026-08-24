import { prisma } from "@/lib/prisma";
import { canViewBeheerderTools } from "@/lib/permissions";
import {
  EventType,
  KpiMetric,
  LeadStatus,
  LeadType,
  Role,
} from "@/generated/prisma/client";
import { getEffectiveViewer } from "@/lib/impersonation";
import { getMonthlyGoalAchievementsForUsers } from "@/lib/actions/production";
import { computeIncentiveLeaderboard, type LeaderboardEntry } from "@/lib/actions/incentives";
import { MONTH_LABELS } from "@/lib/goalLabels";

async function requireBeheerder() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canViewBeheerderTools(viewer)) {
    throw new Error("Je hebt geen toegang tot deze analyse");
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

/**
 * `teamFilter`/`personFilter` beperken alle onderstaande cijfers (FA/RG-
 * kaarten, open leads per fase, overzicht per medewerker) tot een team of
 * één specifieke medewerker — dezelfde structuur/persoon-keuze als elders
 * in de app. `teamFilter` is het id van een Team (rechtstreekse leden +
 * coach, geen substructuur), `"geen"` betekent "zonder team", leeg/`"alle"`
 * betekent geen beperking. `personFilter` overschrijft `teamFilter`.
 */
export async function getAnalytics(teamFilter?: string, personFilter?: string) {
  await requireBeheerder();

  const [leadsAll, usersAll, teams, activityGroupsAll] = await Promise.all([
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

  const users = personFilter
    ? usersAll.filter((u) => u.id === personFilter)
    : !teamFilter || teamFilter === "alle"
    ? usersAll
    : teamFilter === "geen"
    ? usersAll.filter((u) => !(u.coachedTeam ?? u.team))
    : usersAll.filter((u) => (u.coachedTeam ?? u.team)?.id === teamFilter);

  const scopeUserIds = new Set(users.map((u) => u.id));
  const leads = leadsAll.filter((l) => scopeUserIds.has(l.ownerId));
  const activityGroups = activityGroupsAll.filter((g) => scopeUserIds.has(g.assigneeId));

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

// ---------------------------------------------------------------------------
// Uitgebreide Analyse-pagina: funnel-diepgang, trends, productie, kwaliteit,
// klanten, incentives/KPI's/events. Alles hieronder is enkel voor de
// Beheerder (via requireBeheerder), net als getAnalytics() hierboven.
// ---------------------------------------------------------------------------

function monthBucketLabel(date: Date) {
  return date.toLocaleDateString("nl-BE", {
    month: "short",
    year: "2-digit",
    timeZone: "Europe/Brussels",
  });
}

/** Laatste `months` kalendermaanden, oplopend, eindigend met de huidige maand. */
function buildMonthBuckets(months: number, now = new Date()) {
  return Array.from({ length: months }, (_, i) => {
    const bucketStart = new Date(
      now.getFullYear(),
      now.getMonth() - (months - 1 - i),
      1
    );
    return { bucketStart, label: monthBucketLabel(bucketStart) };
  });
}

function monthBucketIndex(buckets: { bucketStart: Date }[], date: Date) {
  const idx =
    (date.getFullYear() - buckets[0].bucketStart.getFullYear()) * 12 +
    (date.getMonth() - buckets[0].bucketStart.getMonth());
  return idx >= 0 && idx < buckets.length ? idx : null;
}

/**
 * De weergavevolgorde van de "hoofd-funnel" per leadtype, voor Drop-off en
 * Gemiddelde doorlooptijd — expliciet op label i.p.v. op de opgeslagen
 * `order`-kolom, omdat die door historische/oudere fases (bv. de vroegere
 * "... ingepland"-vorm, zie meetingPlanning.ts) niet meer overeenkomt met de
 * echte volgorde waarin een lead de funnel doorloopt.
 */
const FUNNEL_DISPLAY_ORDER: Record<LeadType, string[]> = {
  FA: [
    "Eerste contact",
    "Financiële analyse ingepland",
    "Financiële analyse",
    "Adviesgesprek ingepland",
    "Adviesgesprek",
    "Opvolggesprek",
    "Klant",
  ],
  RG: [
    "Eerste contact",
    "Kennismakingsgesprek",
    "Carrièregesprek",
    "Terugkoppeling",
    "Medewerker",
  ],
};

/** De "hoofd-funnel" van een leadtype: actieve fases + de gewonnen-fase, op volgorde — dus zonder Verloren/Opvolging/de "Nieuwe lead"-instapfase. */
async function getFunnelSequence(leadType: LeadType) {
  const labels = FUNNEL_DISPLAY_ORDER[leadType];
  const stages = await prisma.funnelStage.findMany({
    where: { leadType, label: { in: labels } },
  });
  const byLabel = new Map(stages.map((s) => [s.label, s]));
  return labels
    .map((label) => byLabel.get(label))
    .filter((s): s is (typeof stages)[number] => Boolean(s));
}

// ---------------------------------------------------------------------------
// 1. Drop-off per fase-overgang
// ---------------------------------------------------------------------------

export type FunnelDropoffStage = {
  leadType: LeadType;
  key: string;
  label: string;
  reached: number;
  dropoffPercent: number | null;
};

/** Voor elke fase van de hoofd-funnel: hoeveel (niet-verwijderde) leads hebben die fase ooit bereikt, en welk percentage viel af t.o.v. de vorige fase. */
export async function getFunnelDropoff(): Promise<FunnelDropoffStage[]> {
  await requireBeheerder();
  const results: FunnelDropoffStage[] = [];

  for (const leadType of [LeadType.FA, LeadType.RG]) {
    const stages = await getFunnelSequence(leadType);
    if (stages.length === 0) continue;

    const reachedByStage = await Promise.all(
      stages.map((stage) =>
        prisma.leadStageChange.findMany({
          where: { toStageId: stage.id, lead: { deletedAt: null } },
          distinct: ["leadId"],
          select: { leadId: true },
        })
      )
    );

    stages.forEach((stage, i) => {
      const reached = reachedByStage[i].length;
      const previous = i > 0 ? reachedByStage[i - 1].length : null;
      results.push({
        leadType,
        key: stage.key,
        label: stage.label,
        reached,
        dropoffPercent:
          previous && previous > 0
            ? Math.round(((previous - reached) / previous) * 100)
            : null,
      });
    });
  }

  return results;
}

// ---------------------------------------------------------------------------
// 2. Gemiddelde doorlooptijd per fase
// ---------------------------------------------------------------------------

export type StageDuration = {
  leadType: LeadType;
  key: string;
  label: string;
  avgDays: number | null;
  sampleSize: number;
};

/** Gemiddeld aantal dagen dat een lead in elke fase van de hoofd-funnel doorbrengt, gemeten tussen opeenvolgende fase-wissels (ongeacht waar de lead nadien naartoe ging). */
export async function getStageDurations(): Promise<StageDuration[]> {
  await requireBeheerder();
  const results: StageDuration[] = [];

  for (const leadType of [LeadType.FA, LeadType.RG]) {
    const stages = await getFunnelSequence(leadType);
    const stageById = new Map(stages.map((s) => [s.id, s]));

    const changes = await prisma.leadStageChange.findMany({
      where: { lead: { deletedAt: null, leadType } },
      orderBy: [{ leadId: "asc" }, { changedAt: "asc" }],
      select: { leadId: true, toStageId: true, changedAt: true },
    });

    const durationsByStageKey = new Map<string, number[]>();
    let currentLeadId: string | null = null;
    let previous: { toStageId: string; changedAt: Date } | null = null;

    for (const change of changes) {
      if (change.leadId !== currentLeadId) {
        currentLeadId = change.leadId;
        previous = null;
      }
      if (previous) {
        const stage = stageById.get(previous.toStageId);
        if (stage) {
          const days =
            (change.changedAt.getTime() - previous.changedAt.getTime()) /
            (24 * 60 * 60 * 1000);
          const list = durationsByStageKey.get(stage.key) ?? [];
          list.push(days);
          durationsByStageKey.set(stage.key, list);
        }
      }
      previous = { toStageId: change.toStageId, changedAt: change.changedAt };
    }

    for (const stage of stages) {
      const list = durationsByStageKey.get(stage.key) ?? [];
      results.push({
        leadType,
        key: stage.key,
        label: stage.label,
        avgDays:
          list.length > 0
            ? Math.round((list.reduce((s, d) => s + d, 0) / list.length) * 10) / 10
            : null,
        sampleSize: list.length,
      });
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// 3. Trend over tijd (nieuwe/gewonnen/verloren per maand) + seizoenspatroon
// ---------------------------------------------------------------------------

export type TrendPoint = {
  label: string;
  newLeads: number;
  won: number;
  lost: number;
};

/** Nieuwe leads, gewonnen en verloren per kalendermaand, over de laatste `months` maanden — optioneel gefilterd op leadtype. Eerste/laatste bucket laten ook meteen maand-op-maand-groei berekenen in de UI. */
export async function getLeadTrend(
  leadType: LeadType | null,
  months = 12
): Promise<TrendPoint[]> {
  await requireBeheerder();
  const buckets = buildMonthBuckets(months);
  const rangeStart = buckets[0].bucketStart;

  const [leads, wins, losses] = await Promise.all([
    prisma.lead.findMany({
      where: {
        deletedAt: null,
        createdAt: { gte: rangeStart },
        ...(leadType ? { leadType } : {}),
      },
      select: { createdAt: true },
    }),
    prisma.leadStageChange.findMany({
      where: {
        changedAt: { gte: rangeStart },
        toStage: { isWon: true },
        lead: { deletedAt: null, ...(leadType ? { leadType } : {}) },
      },
      orderBy: { changedAt: "asc" },
      distinct: ["leadId"],
      select: { changedAt: true },
    }),
    prisma.leadStageChange.findMany({
      where: {
        changedAt: { gte: rangeStart },
        toStage: { isLost: true },
        lead: { deletedAt: null, ...(leadType ? { leadType } : {}) },
      },
      orderBy: { changedAt: "asc" },
      distinct: ["leadId"],
      select: { changedAt: true },
    }),
  ]);

  const points = buckets.map((b) => ({
    label: b.label,
    newLeads: 0,
    won: 0,
    lost: 0,
  }));

  for (const l of leads) {
    const idx = monthBucketIndex(buckets, l.createdAt);
    if (idx !== null) points[idx].newLeads++;
  }
  for (const w of wins) {
    const idx = monthBucketIndex(buckets, w.changedAt);
    if (idx !== null) points[idx].won++;
  }
  for (const l of losses) {
    const idx = monthBucketIndex(buckets, l.changedAt);
    if (idx !== null) points[idx].lost++;
  }

  return points;
}

export type SeasonalBucket = {
  month: number;
  label: string;
  newLeads: number;
  won: number;
  financieleAnalyses: number;
  adviesgesprekken: number;
};

const FINANCIELE_ANALYSE_LABELS = ["Financiële analyse", "Financiële analyse ingepland"];
const ADVIESGESPREK_LABELS = ["Adviesgesprek", "Adviesgesprek ingepland"];

/** Nieuwe leads, gewonnen leads, financiële analyses en adviesgesprekken per kalendermaand, opgeteld over alle jaren — toont seizoenspatronen (bv. piekmaanden), optioneel gefilterd op leadtype. */
export async function getSeasonalPattern(
  leadType: LeadType | null
): Promise<SeasonalBucket[]> {
  await requireBeheerder();

  const [leads, wins, financieleAnalyses, adviesgesprekken] = await Promise.all([
    prisma.lead.findMany({
      where: { deletedAt: null, ...(leadType ? { leadType } : {}) },
      select: { createdAt: true },
    }),
    prisma.leadStageChange.findMany({
      where: {
        toStage: { isWon: true },
        lead: { deletedAt: null, ...(leadType ? { leadType } : {}) },
      },
      orderBy: { changedAt: "asc" },
      distinct: ["leadId"],
      select: { changedAt: true },
    }),
    prisma.leadStageChange.findMany({
      where: {
        toStage: { label: { in: FINANCIELE_ANALYSE_LABELS } },
        lead: { deletedAt: null, ...(leadType ? { leadType } : {}) },
      },
      select: { changedAt: true },
    }),
    prisma.leadStageChange.findMany({
      where: {
        toStage: { label: { in: ADVIESGESPREK_LABELS } },
        lead: { deletedAt: null, ...(leadType ? { leadType } : {}) },
      },
      select: { changedAt: true },
    }),
  ]);

  const buckets: SeasonalBucket[] = MONTH_LABELS.map((label, i) => ({
    month: i + 1,
    label,
    newLeads: 0,
    won: 0,
    financieleAnalyses: 0,
    adviesgesprekken: 0,
  }));

  for (const l of leads) buckets[l.createdAt.getMonth()].newLeads++;
  for (const w of wins) buckets[w.changedAt.getMonth()].won++;
  for (const f of financieleAnalyses) buckets[f.changedAt.getMonth()].financieleAnalyses++;
  for (const a of adviesgesprekken) buckets[a.changedAt.getMonth()].adviesgesprekken++;

  return buckets;
}

// ---------------------------------------------------------------------------
// 4. Cross-sell, klantwaarde, omzet per productiemaand
// ---------------------------------------------------------------------------

export type CustomerValueStats = {
  totalCustomers: number;
  customersWithProducts: number;
  multiProductCustomers: number;
  crossSellPercent: number | null;
  avgAmountPerCustomer: number;
  avgUnitsPerCustomer: number;
};

/** Cross-sell (% klanten met >1 producttype) en gemiddeld bedrag/eenheden per klant. */
export async function getCustomerValueStats(): Promise<CustomerValueStats> {
  await requireBeheerder();

  const customers = await prisma.lead.findMany({
    where: { deletedAt: null, status: "WON" },
    select: { products: { select: { type: true, amount: true, units: true } } },
  });

  let customersWithProducts = 0;
  let multiProductCustomers = 0;
  let totalAmount = 0;
  let totalUnits = 0;

  for (const c of customers) {
    if (c.products.length === 0) continue;
    customersWithProducts++;
    const distinctTypes = new Set(c.products.map((p) => p.type));
    if (distinctTypes.size > 1) multiProductCustomers++;
    totalAmount += c.products.reduce((s, p) => s + Number(p.amount), 0);
    totalUnits += c.products.reduce((s, p) => s + p.units, 0);
  }

  return {
    totalCustomers: customers.length,
    customersWithProducts,
    multiProductCustomers,
    crossSellPercent:
      customersWithProducts > 0
        ? Math.round((multiProductCustomers / customersWithProducts) * 100)
        : null,
    avgAmountPerCustomer:
      customersWithProducts > 0 ? Math.round(totalAmount / customersWithProducts) : 0,
    avgUnitsPerCustomer:
      customersWithProducts > 0
        ? Math.round((totalUnits / customersWithProducts) * 10) / 10
        : 0,
  };
}

export type ProductionMonthRevenue = {
  month: number;
  label: string;
  revenue: number;
  units: number;
};

/** Effectieve begin/eind van elk van de 12 productiemaanden van `year` — ingesteld via ProductionMonth, anders de kalendermaand. */
async function resolveProductionMonthRanges(year: number) {
  const configured = await prisma.productionMonth.findMany({ where: { year } });
  const byMonth = new Map(configured.map((c) => [c.month, c]));
  return Array.from({ length: 12 }, (_, i) => {
    const month = i + 1;
    const existing = byMonth.get(month);
    if (existing) {
      return {
        month,
        start: existing.startDate,
        end: new Date(existing.endDate.getTime() + 1),
      };
    }
    return { month, start: new Date(year, month - 1, 1), end: new Date(year, month, 1) };
  });
}

/**
 * Omzet en eenheden per productiemaand van `year`, geteld op contractDate
 * van elk product (los van wanneer de klant oorspronkelijk klant werd) —
 * zodat ook vervolgcontracten uit opvolging meetellen in de maand waarin
 * ze zelf afgesloten zijn.
 */
export async function getRevenueByProductionMonth(
  year: number
): Promise<ProductionMonthRevenue[]> {
  await requireBeheerder();
  const ranges = await resolveProductionMonthRanges(year);

  return Promise.all(
    ranges.map(async ({ month, start, end }) => {
      const products = await prisma.leadProduct.findMany({
        where: {
          contractDate: { gte: start, lt: end },
          lead: { deletedAt: null, status: "WON" },
        },
        select: { amount: true, units: true },
      });
      const revenue = products.reduce((sum, p) => sum + Number(p.amount), 0);
      const units = products.reduce((sum, p) => sum + p.units, 0);
      return { month, label: MONTH_LABELS[month - 1], revenue, units };
    })
  );
}

// ---------------------------------------------------------------------------
// 5. Opvolgkwaliteit: no-show, voicemail, contactpogingen vóór conversie
// ---------------------------------------------------------------------------

export type ActivityQualityStats = {
  noShowRatio: number | null;
  voicemailRatio: number | null;
  avgContactAttemptsBeforeWon: number | null;
};

/** No-show-ratio (afspraken), voicemail-ratio (telefoons) en gemiddeld aantal afgeronde contactmomenten vóór een lead klant wordt. */
export async function getActivityQualityStats(): Promise<ActivityQualityStats> {
  await requireBeheerder();

  const [scheduledOutcomes, completedCalls, wonLeads] = await Promise.all([
    prisma.activity.groupBy({
      by: ["status"],
      where: {
        type: { in: ["CALL", "MEETING"] },
        status: { in: ["COMPLETED", "NO_SHOW"] },
      },
      _count: { _all: true },
    }),
    prisma.activity.groupBy({
      by: ["wasVoicemail"],
      where: { type: "CALL", status: "COMPLETED" },
      _count: { _all: true },
    }),
    prisma.leadStageChange.findMany({
      where: { toStage: { isWon: true }, lead: { deletedAt: null } },
      orderBy: { changedAt: "asc" },
      distinct: ["leadId"],
      select: { leadId: true, changedAt: true },
    }),
  ]);

  const completed =
    scheduledOutcomes.find((s) => s.status === "COMPLETED")?._count._all ?? 0;
  const noShow =
    scheduledOutcomes.find((s) => s.status === "NO_SHOW")?._count._all ?? 0;
  const noShowTotal = completed + noShow;

  const voicemail =
    completedCalls.find((c) => c.wasVoicemail)?._count._all ?? 0;
  const reached =
    completedCalls.find((c) => !c.wasVoicemail)?._count._all ?? 0;
  const callTotal = voicemail + reached;

  let avgContactAttemptsBeforeWon: number | null = null;
  if (wonLeads.length > 0) {
    const wonAtByLead = new Map(wonLeads.map((w) => [w.leadId, w.changedAt]));
    const activities = await prisma.activity.findMany({
      where: {
        leadId: { in: wonLeads.map((w) => w.leadId) },
        type: { in: ["CALL", "MEETING"] },
        status: "COMPLETED",
      },
      select: { leadId: true, completedAt: true },
    });
    const countByLead = new Map<string, number>();
    for (const a of activities) {
      const wonAt = wonAtByLead.get(a.leadId);
      if (wonAt && a.completedAt && a.completedAt <= wonAt) {
        countByLead.set(a.leadId, (countByLead.get(a.leadId) ?? 0) + 1);
      }
    }
    const sum = wonLeads.reduce((s, w) => s + (countByLead.get(w.leadId) ?? 0), 0);
    avgContactAttemptsBeforeWon = Math.round((sum / wonLeads.length) * 10) / 10;
  }

  return {
    noShowRatio: noShowTotal > 0 ? Math.round((noShow / noShowTotal) * 100) : null,
    voicemailRatio: callTotal > 0 ? Math.round((voicemail / callTotal) * 100) : null,
    avgContactAttemptsBeforeWon,
  };
}

// ---------------------------------------------------------------------------
// 6. Klantengroei-curve + belastingsaangifte-status geaggregeerd
// ---------------------------------------------------------------------------

export type CustomerGrowthPoint = {
  label: string;
  cumulative: number;
};

/** Cumulatief aantal klanten (gewonnen leads) over de laatste `months` maanden. */
export async function getCustomerGrowthCurve(
  months = 12
): Promise<CustomerGrowthPoint[]> {
  await requireBeheerder();
  const buckets = buildMonthBuckets(months);
  const rangeStart = buckets[0].bucketStart;

  const [priorWins, winsInRange] = await Promise.all([
    prisma.leadStageChange.findMany({
      where: {
        toStage: { isWon: true },
        changedAt: { lt: rangeStart },
        lead: { deletedAt: null },
      },
      distinct: ["leadId"],
      select: { leadId: true },
    }),
    prisma.leadStageChange.findMany({
      where: {
        toStage: { isWon: true },
        changedAt: { gte: rangeStart },
        lead: { deletedAt: null },
      },
      orderBy: { changedAt: "asc" },
      distinct: ["leadId"],
      select: { changedAt: true },
    }),
  ]);

  const newPerBucket = new Array(months).fill(0);
  for (const w of winsInRange) {
    const idx = monthBucketIndex(buckets, w.changedAt);
    if (idx !== null) newPerBucket[idx]++;
  }

  let running = priorWins.length;
  return buckets.map((b, i) => {
    running += newPerBucket[i];
    return { label: b.label, cumulative: running };
  });
}

export type TaxStatusBreakdown = {
  status: "TODO" | "SCHEDULED" | "DONE" | "NVT" | "BOEKHOUDER";
  label: string;
  count: number;
  percent: number;
};

const TAX_STATUS_LABELS: Record<TaxStatusBreakdown["status"], string> = {
  DONE: "Belastingsaangifte Gedaan",
  TODO: "Belastingsaangifte nog te doen",
  SCHEDULED: "Belastingsaangifte Ingepland",
  NVT: "NVT",
  BOEKHOUDER: "Boekhouder",
};

/** Verdeling van de belastingsaangifte-status over alle klanten (niet ingesteld telt als "Nog te doen", zoals ook op de Klanten-pagina). */
export async function getTaxStatusBreakdown(): Promise<TaxStatusBreakdown[]> {
  await requireBeheerder();

  const customers = await prisma.lead.findMany({
    where: { deletedAt: null, status: "WON" },
    select: { taxDeclarationStatus: true },
  });

  const counts: Record<TaxStatusBreakdown["status"], number> = {
    DONE: 0,
    TODO: 0,
    SCHEDULED: 0,
    NVT: 0,
    BOEKHOUDER: 0,
  };
  for (const c of customers) {
    const status = c.taxDeclarationStatus ?? "TODO";
    counts[status]++;
  }

  const total = customers.length;
  return (Object.keys(counts) as TaxStatusBreakdown["status"][]).map((status) => ({
    status,
    label: TAX_STATUS_LABELS[status],
    count: counts[status],
    percent: total > 0 ? Math.round((counts[status] / total) * 100) : 0,
  }));
}

// ---------------------------------------------------------------------------
// 7. Incentives, KPI's, events
// ---------------------------------------------------------------------------

export type IncentiveOverviewEntry = {
  incentiveId: string;
  title: string;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  topEntries: LeaderboardEntry[];
  achievedCount: number;
  totalParticipants: number;
};

/** Alle incentives van de laatste 90 dagen (nog lopend of net afgelopen) met hun top-3 en aantal dat de vereisten haalt, in één overzicht i.p.v. per incentive apart. */
export async function getIncentiveOverview(): Promise<IncentiveOverviewEntry[]> {
  await requireBeheerder();
  const now = new Date();
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const incentives = await prisma.incentive.findMany({
    where: { endDate: { gte: ninetyDaysAgo } },
    orderBy: { startDate: "desc" },
    include: { categories: { orderBy: { order: "asc" } } },
  });

  return Promise.all(
    incentives.map(async (incentive) => {
      const leaderboard = await computeIncentiveLeaderboard(incentive);
      return {
        incentiveId: incentive.id,
        title: incentive.title,
        startDate: incentive.startDate,
        endDate: incentive.endDate,
        isActive: incentive.startDate <= now && now <= incentive.endDate,
        topEntries: leaderboard.slice(0, 3),
        achievedCount: leaderboard.filter((e) => e.achieved).length,
        totalParticipants: leaderboard.length,
      };
    })
  );
}

export type KpiHeatmapCell = {
  metric: KpiMetric;
  month: number;
  /** null = maand nog niet afgelopen, of nog geen doel/data. 0-100(+), kan boven 100 uitkomen bij een overschrijding. */
  percent: number | null;
};

export type KpiHeatmapRow = {
  userId: string;
  name: string;
  cells: KpiHeatmapCell[];
};

/**
 * Per actieve gebruiker, per maand van `year`, of elke KPI gehaald is:
 * Productie/Gesprekken automatisch (zelfde als de jaarlijkse KPI-kaart),
 * Belsessie/Seminarie = minstens 1 bevestigd bijgewoond evenement van dat
 * type die maand (enkel evenementen die een Beheerder/Admin achteraf
 * bevestigd heeft tellen mee).
 */
export async function getKpiHeatmap(year: number): Promise<KpiHeatmapRow[]> {
  await requireBeheerder();

  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
  const userIds = users.map((u) => u.id);
  const now = new Date();

  const [achievementsByUser, callingSessionAttendances, seminarAttendances] =
    await Promise.all([
      getMonthlyGoalAchievementsForUsers(userIds, year),
      prisma.eventAttendance.findMany({
        where: {
          userId: { in: userIds },
          actualStatus: "GOING",
          event: {
            type: EventType.BELSESSIE,
            date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
          },
        },
        select: { userId: true, event: { select: { date: true } } },
      }),
      prisma.eventAttendance.findMany({
        where: {
          userId: { in: userIds },
          actualStatus: "GOING",
          event: {
            type: EventType.SEMINAR,
            date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) },
          },
        },
        select: { userId: true, event: { select: { date: true } } },
      }),
    ]);

  const callingSessionMonthsByUser = new Map<string, Set<number>>();
  for (const a of callingSessionAttendances) {
    const months = callingSessionMonthsByUser.get(a.userId) ?? new Set<number>();
    months.add(a.event.date.getMonth() + 1);
    callingSessionMonthsByUser.set(a.userId, months);
  }
  const seminarMonthsByUser = new Map<string, Set<number>>();
  for (const a of seminarAttendances) {
    const months = seminarMonthsByUser.get(a.userId) ?? new Set<number>();
    months.add(a.event.date.getMonth() + 1);
    seminarMonthsByUser.set(a.userId, months);
  }

  return users.map((u) => {
    const monthlyAchievements = achievementsByUser.get(u.id) ?? [];
    const callingSessionMonths = callingSessionMonthsByUser.get(u.id) ?? new Set<number>();
    const seminarMonths = seminarMonthsByUser.get(u.id) ?? new Set<number>();

    const cells: KpiHeatmapCell[] = [];
    for (let month = 1; month <= 12; month++) {
      const notYetOver = now < new Date(year, month, 1);
      const production = monthlyAchievements.find((m) => m.month === month);
      cells.push({
        metric: KpiMetric.PRODUCTION,
        month,
        percent: production?.unitsPercent ?? null,
      });
      cells.push({
        metric: KpiMetric.CONVERSATIONS,
        month,
        percent: production?.conversationsPercent ?? null,
      });
      cells.push({
        metric: KpiMetric.CALLING_SESSION,
        month,
        percent: notYetOver ? null : callingSessionMonths.has(month) ? 100 : 0,
      });
      cells.push({
        metric: KpiMetric.SEMINAR,
        month,
        percent: notYetOver ? null : seminarMonths.has(month) ? 100 : 0,
      });
    }

    return { userId: u.id, name: u.name, cells };
  });
}

const EVENT_TYPE_LABELS: Record<EventType, string> = {
  MEETING: "Vergadering",
  SEMINAR: "Seminarie",
  BELSESSIE: "Belsessie",
  MANAGEMENTMEETING: "Managementmeeting",
  STRUCTUURMEETING: "Structuur meeting",
};

export type EventAttendanceStats = {
  byEventType: {
    type: EventType;
    label: string;
    totalVerified: number;
    totalGoing: number;
    ratio: number | null;
  }[];
  byEmployee: {
    userId: string;
    name: string;
    totalVerified: number;
    totalGoing: number;
    ratio: number | null;
  }[];
};

/** Effectieve aanwezigheidsratio (bevestigd door Beheerder/Admin) per evenement-type en per medewerker. */
export async function getEventAttendanceStats(): Promise<EventAttendanceStats> {
  await requireBeheerder();

  const attendances = await prisma.eventAttendance.findMany({
    where: { actualStatus: { not: null } },
    select: {
      actualStatus: true,
      user: { select: { id: true, name: true } },
      event: { select: { type: true } },
    },
  });

  const byTypeMap = new Map<EventType, { total: number; going: number }>();
  const byUserMap = new Map<string, { name: string; total: number; going: number }>();

  for (const a of attendances) {
    const typeEntry = byTypeMap.get(a.event.type) ?? { total: 0, going: 0 };
    typeEntry.total++;
    if (a.actualStatus === "GOING") typeEntry.going++;
    byTypeMap.set(a.event.type, typeEntry);

    const userEntry = byUserMap.get(a.user.id) ?? {
      name: a.user.name,
      total: 0,
      going: 0,
    };
    userEntry.total++;
    if (a.actualStatus === "GOING") userEntry.going++;
    byUserMap.set(a.user.id, userEntry);
  }

  const byEventType = Array.from(byTypeMap.entries()).map(([type, v]) => ({
    type,
    label: EVENT_TYPE_LABELS[type],
    totalVerified: v.total,
    totalGoing: v.going,
    ratio: v.total > 0 ? Math.round((v.going / v.total) * 100) : null,
  }));

  const byEmployee = Array.from(byUserMap.entries())
    .map(([userId, v]) => ({
      userId,
      name: v.name,
      totalVerified: v.total,
      totalGoing: v.going,
      ratio: v.total > 0 ? Math.round((v.going / v.total) * 100) : null,
    }))
    .sort((a, b) => (b.ratio ?? 0) - (a.ratio ?? 0));

  return { byEventType, byEmployee };
}
