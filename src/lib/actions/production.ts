"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageUsers } from "@/lib/permissions";
import { GoalMetric, JobFunction, Role } from "@/generated/prisma/client";
import {
  GOAL_METRIC_ORDER,
  MONTHLY_GOAL_METRICS,
  MONTHLY_ACTUAL_METRICS,
} from "@/lib/goalLabels";

async function requireViewer() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  return viewer;
}

async function requireGoalManager() {
  const viewer = await requireViewer();
  if (!canManageUsers(viewer)) {
    throw new Error("Je hebt geen rechten om doelen te beheren");
  }
  return viewer;
}

function monthRange(year: number, month: number) {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

/**
 * Effectieve begin/eind (exclusieve bovengrens) van een productiemaand: de
 * ingestelde datums via `ProductionMonth` als die er zijn, anders valt terug
 * op de kalendermaand.
 */
async function getProductionMonthRange(year: number, month: number) {
  const configured = await prisma.productionMonth.findUnique({
    where: { year_month: { year, month } },
  });
  if (configured) {
    return {
      start: configured.startDate,
      end: new Date(configured.endDate.getTime() + 1),
    };
  }
  return monthRange(year, month);
}

/** Maandag 00:00 t.e.m. volgende maandag 00:00 (lokale tijd) van de huidige week. */
function currentWeekRange() {
  const now = new Date();
  const day = now.getDay(); // 0 = zondag
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() + diffToMonday);
  const end = new Date(start);
  end.setDate(end.getDate() + 7);
  return { start, end };
}

/** Welke productiemaand "nu" valt: de ingestelde maand waar `now` binnen valt, anders de kalendermaand. */
export async function getCurrentProductionMonth() {
  const now = new Date();
  const configured = await prisma.productionMonth.findFirst({
    where: { startDate: { lte: now }, endDate: { gte: now } },
  });
  if (configured) {
    return { year: configured.year, month: configured.month };
  }
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
}

/**
 * "Dit jaar" voor de Klanten-statistieken: begint op dag 1 van
 * productiemaand 1 en eindigt op de laatste dag van productiemaand 12 van
 * het huidige productiejaar — dus rechtstreeks afgeleid van de ingestelde
 * productiemaanden, zonder aparte instelling.
 */
export async function getCurrentProductionYearRange(): Promise<{
  startDate: Date;
  endDate: Date;
}> {
  const { year } = await getCurrentProductionMonth();
  const first = await getProductionMonthRange(year, 1);
  const last = await getProductionMonthRange(year, 12);
  return { startDate: first.start, endDate: new Date(last.end.getTime() - 1) };
}

/**
 * "Deze maand" voor de Klanten-statistieken: begin/einddatum van de huidige
 * productiemaand — een klant wordt dus geteld in de productiemaand waarin
 * hij effectief klant geworden is, zonder aparte instelling.
 */
export async function getCurrentProductionMonthRange(): Promise<{
  startDate: Date;
  endDate: Date;
}> {
  const { year, month } = await getCurrentProductionMonth();
  const range = await getProductionMonthRange(year, month);
  return { startDate: range.start, endDate: new Date(range.end.getTime() - 1) };
}

// ---------------------------------------------------------------------------
// Productie: ranglijst per maand (Klanten/Eenheden), vergelijkbaar met de
// "PRODUCTIE"-tab van de Excel.
// ---------------------------------------------------------------------------

export type ProductionRow = {
  id: string;
  name: string;
  jobFunction: JobFunction | null;
  coachName: string | null;
  targetCustomers: number;
  actualCustomers: number;
  percentCustomers: number | null;
  targetUnits: number;
  actualUnits: number;
  percentUnits: number | null;
  conversationsPerWeek: number;
};

export async function getProductionLeaderboard(
  year: number,
  month: number
): Promise<ProductionRow[]> {
  await requireViewer();
  const { start, end } = await getProductionMonthRange(year, month);
  // "Gesprekken/week" toont het effectieve aantal van de lopende week
  // (maandag t.e.m. zondag) — niet een gemiddelde over de maand, want een
  // gesprek is een geheel getal (je hebt er wel of geen).
  const week = currentWeekRange();

  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      jobFunction: true,
      team: { select: { coach: { select: { name: true } } } },
      monthlyGoals: { where: { year, month } },
      monthlyActuals: {
        where: {
          year,
          month,
          metric: { in: [GoalMetric.CUSTOMERS, GoalMetric.UNITS] },
        },
      },
    },
    orderBy: { name: "asc" },
  });
  const userIds = users.map((u) => u.id);

  const [wonThisMonth, conversationsThisWeek] = await Promise.all([
    prisma.leadStageChange.findMany({
      where: {
        changedById: { in: userIds },
        toStage: { isWon: true },
        changedAt: { gte: start, lt: end },
      },
      select: {
        changedById: true,
        lead: { select: { id: true, products: { select: { units: true } } } },
      },
    }),
    prisma.activity.groupBy({
      by: ["assigneeId"],
      where: {
        assigneeId: { in: userIds },
        status: "PLANNED",
        type: { in: ["CALL", "MEETING"] },
        scheduledAt: { gte: week.start, lt: week.end },
        lead: { leadType: "FA" },
      },
      _count: { _all: true },
    }),
  ]);

  const conversationsByUser = new Map(
    conversationsThisWeek.map((c) => [c.assigneeId, c._count._all])
  );

  const wonByUser = new Map<string, { customers: Set<string>; units: number }>();
  for (const change of wonThisMonth) {
    const entry = wonByUser.get(change.changedById) ?? {
      customers: new Set<string>(),
      units: 0,
    };
    if (!entry.customers.has(change.lead.id)) {
      entry.customers.add(change.lead.id);
      entry.units += change.lead.products.reduce((s, p) => s + p.units, 0);
    }
    wonByUser.set(change.changedById, entry);
  }

  const rows = users.map((u) => {
    const goalByMetric = new Map(
      u.monthlyGoals.map((g) => [g.metric, Number(g.target)])
    );
    const actualOverrideByMetric = new Map(
      u.monthlyActuals.map((a) => [a.metric, Number(a.value)])
    );
    const won = wonByUser.get(u.id);
    const actualCustomers =
      actualOverrideByMetric.get(GoalMetric.CUSTOMERS) ?? won?.customers.size ?? 0;
    const actualUnits =
      actualOverrideByMetric.get(GoalMetric.UNITS) ?? won?.units ?? 0;
    const targetCustomers = goalByMetric.get(GoalMetric.CUSTOMERS) ?? 0;
    const targetUnits = goalByMetric.get(GoalMetric.UNITS) ?? 0;

    return {
      id: u.id,
      name: u.name,
      jobFunction: u.jobFunction,
      coachName: u.team?.coach.name ?? null,
      targetCustomers,
      actualCustomers,
      percentCustomers:
        targetCustomers > 0
          ? Math.round((actualCustomers / targetCustomers) * 100)
          : null,
      targetUnits,
      actualUnits,
      percentUnits:
        targetUnits > 0 ? Math.round((actualUnits / targetUnits) * 100) : null,
      conversationsPerWeek: conversationsByUser.get(u.id) ?? 0,
    };
  });

  return rows.sort((a, b) => b.actualUnits - a.actualUnits);
}

// ---------------------------------------------------------------------------
// Gesprekken: wekelijkse ranglijst, vergelijkbaar met de "FA GESPREKKEN"-tab.
// ---------------------------------------------------------------------------

export type ConversationsRow = {
  id: string;
  name: string;
  jobFunction: JobFunction | null;
  target: number;
  actual: number;
  percent: number | null;
  growth: number;
  toBePlanned: number;
};

/** Aantal (afgeronde) weken dat een periode beslaat, minstens 1. */
function weeksInRange(start: Date, end: Date) {
  const days = (end.getTime() - start.getTime()) / (24 * 60 * 60 * 1000);
  return Math.max(1, Math.round(days / 7));
}

/**
 * Week (ma-zo) + productiemaand waarvan het maandelijkse gesprekken-doel
 * wordt afgeleid — voor weergave boven de Gesprekken-ranglijst.
 */
export async function getCurrentConversationsContext() {
  const week = currentWeekRange();
  const { year, month } = await getCurrentProductionMonth();
  return {
    weekStart: week.start,
    weekEnd: new Date(week.end.getTime() - 1),
    year,
    month,
  };
}

/**
 * Het wekelijkse gesprekken-doel is afgeleid van het maandelijkse
 * Gesprekken-doel voor de huidige productiemaand (`UserMonthlyGoal`),
 * verdeeld over het aantal weken dat die productiemaand beslaat — zo weet
 * je hoeveel je die week effectief moet inplannen.
 */
export async function getConversationsLeaderboard(): Promise<ConversationsRow[]> {
  await requireViewer();
  const week = currentWeekRange();
  const { year, month } = await getCurrentProductionMonth();
  const { start: monthStart, end: monthEnd } = await getProductionMonthRange(
    year,
    month
  );
  const weeks = weeksInRange(monthStart, monthEnd);

  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      jobFunction: true,
      monthlyGoals: {
        where: { year, month, metric: GoalMetric.CONVERSATIONS },
      },
    },
    orderBy: { name: "asc" },
  });
  const userIds = users.map((u) => u.id);

  const conversations = await prisma.activity.groupBy({
    by: ["assigneeId"],
    where: {
      assigneeId: { in: userIds },
      status: "PLANNED",
      type: { in: ["CALL", "MEETING"] },
      scheduledAt: { gte: week.start, lt: week.end },
      lead: { leadType: "FA" },
    },
    _count: { _all: true },
  });
  const actualByUser = new Map(
    conversations.map((c) => [c.assigneeId, c._count._all])
  );

  const rows = users.map((u) => {
    const monthlyTarget = Number(u.monthlyGoals[0]?.target ?? 0);
    const target = monthlyTarget > 0 ? Math.round(monthlyTarget / weeks) : 0;
    const actual = actualByUser.get(u.id) ?? 0;
    return {
      id: u.id,
      name: u.name,
      jobFunction: u.jobFunction,
      target,
      actual,
      percent: target > 0 ? Math.round((actual / target) * 100) : null,
      growth: actual - target,
      toBePlanned: Math.max(target - actual, 0),
    };
  });

  return rows.sort((a, b) => b.actual - a.actual);
}

// ---------------------------------------------------------------------------
// Dashboard: doel vs. stand van zaken per productiemaand, voor de ingelogde
// gebruiker.
// ---------------------------------------------------------------------------

export type GoalProgress = {
  metric: GoalMetric;
  actual: number;
  target: number;
  percent: number | null;
};

/**
 * Doelen op het dashboard: Eenheden/Klanten/ABV verkoop/ABV RG worden
 * beoordeeld over de volledige lopende productiemaand (doel = het
 * maanddoel). Gesprekken wordt — net als op de Productie-tab — per week
 * beoordeeld: het maanddoel gedeeld door het aantal weken in de
 * productiemaand.
 */
export async function getProductionMonthGoalProgress(userId: string): Promise<{
  year: number;
  month: number;
  periodStart: Date;
  periodEnd: Date;
  weekStart: Date;
  weekEnd: Date;
  rows: GoalProgress[];
}> {
  await requireViewer();
  const { year, month } = await getCurrentProductionMonth();
  const { start, end } = await getProductionMonthRange(year, month);
  const week = currentWeekRange();
  const weeks = weeksInRange(start, end);

  const [targets, wonThisMonth, conversationsThisWeek, newFaLeads, newRgLeads] =
    await Promise.all([
      prisma.userMonthlyGoal.findMany({ where: { userId, year, month } }),
      prisma.leadStageChange.findMany({
        where: {
          changedById: userId,
          toStage: { isWon: true },
          changedAt: { gte: start, lt: end },
        },
        select: {
          lead: {
            select: { id: true, products: { select: { units: true } } },
          },
        },
      }),
      prisma.activity.count({
        where: {
          assigneeId: userId,
          status: "PLANNED",
          type: { in: ["CALL", "MEETING"] },
          scheduledAt: { gte: week.start, lt: week.end },
          lead: { leadType: "FA" },
        },
      }),
      prisma.lead.count({
        where: {
          ownerId: userId,
          deletedAt: null,
          leadType: "FA",
          createdAt: { gte: start, lt: end },
        },
      }),
      prisma.lead.count({
        where: {
          ownerId: userId,
          deletedAt: null,
          leadType: "RG",
          createdAt: { gte: start, lt: end },
        },
      }),
    ]);

  const targetByMetric = new Map(
    targets.map((t) => [t.metric, Number(t.target)])
  );

  const seenLeadIds = new Set<string>();
  const units = wonThisMonth
    .map((c) => c.lead)
    .filter((lead) => {
      if (seenLeadIds.has(lead.id)) return false;
      seenLeadIds.add(lead.id);
      return true;
    })
    .reduce((sum, lead) => sum + lead.products.reduce((s, p) => s + p.units, 0), 0);
  const customers = seenLeadIds.size;

  const monthlyConversationsTarget = targetByMetric.get(GoalMetric.CONVERSATIONS) ?? 0;
  const weeklyConversationsTarget =
    monthlyConversationsTarget > 0 ? Math.round(monthlyConversationsTarget / weeks) : 0;

  const actualByMetric: Record<GoalMetric, number> = {
    UNITS: units,
    CUSTOMERS: customers,
    CONVERSATIONS: conversationsThisWeek,
    ABV_SALES: newFaLeads,
    ABV_RG: newRgLeads,
  };
  const effectiveTargetByMetric: Record<GoalMetric, number> = {
    UNITS: targetByMetric.get(GoalMetric.UNITS) ?? 0,
    CUSTOMERS: targetByMetric.get(GoalMetric.CUSTOMERS) ?? 0,
    CONVERSATIONS: weeklyConversationsTarget,
    ABV_SALES: targetByMetric.get(GoalMetric.ABV_SALES) ?? 0,
    ABV_RG: targetByMetric.get(GoalMetric.ABV_RG) ?? 0,
  };

  const rows = GOAL_METRIC_ORDER.map((metric) => {
    const target = effectiveTargetByMetric[metric];
    const actual = actualByMetric[metric];
    return {
      metric,
      actual,
      target,
      percent: target > 0 ? Math.round((actual / target) * 100) : null,
    };
  });

  return {
    year,
    month,
    periodStart: start,
    periodEnd: new Date(end.getTime() - 1),
    weekStart: week.start,
    weekEnd: new Date(week.end.getTime() - 1),
    rows,
  };
}

export type MonthlyGoalAchievement = {
  month: number;
  unitsAchieved: boolean | null;
  conversationsAchieved: boolean | null;
};

/**
 * Per productiemaand van `year`: is het Eenheden- resp. Gesprekken-doel
 * (over de volledige productiemaand) gehaald? `null` zolang de
 * productiemaand nog niet afgelopen is, of als er geen doel is ingesteld —
 * telt dan niet mee voor KPI Productie/Gesprekken op de jaarlijkse
 * KPI-kaart.
 */
export async function getMonthlyGoalAchievements(
  userId: string,
  year: number
): Promise<MonthlyGoalAchievement[]> {
  await requireViewer();
  const now = new Date();

  return Promise.all(
    Array.from({ length: 12 }, (_, i) => i + 1).map(async (month) => {
      const { start, end } = await getProductionMonthRange(year, month);
      if (now < end) {
        return { month, unitsAchieved: null, conversationsAchieved: null };
      }

      const [targets, unitsOverride, wonThisMonth, conversations] = await Promise.all([
        prisma.userMonthlyGoal.findMany({
          where: {
            userId,
            year,
            month,
            metric: { in: [GoalMetric.UNITS, GoalMetric.CONVERSATIONS] },
          },
        }),
        prisma.userMonthlyActual.findUnique({
          where: {
            userId_metric_year_month: {
              userId,
              metric: GoalMetric.UNITS,
              year,
              month,
            },
          },
        }),
        prisma.leadStageChange.findMany({
          where: {
            changedById: userId,
            toStage: { isWon: true },
            changedAt: { gte: start, lt: end },
          },
          select: {
            lead: { select: { id: true, products: { select: { units: true } } } },
          },
        }),
        prisma.activity.count({
          where: {
            assigneeId: userId,
            status: "PLANNED",
            type: { in: ["CALL", "MEETING"] },
            scheduledAt: { gte: start, lt: end },
            lead: { leadType: "FA" },
          },
        }),
      ]);

      const targetByMetric = new Map(
        targets.map((t) => [t.metric, Number(t.target)])
      );
      const unitsTarget = targetByMetric.get(GoalMetric.UNITS) ?? 0;
      const conversationsTarget = targetByMetric.get(GoalMetric.CONVERSATIONS) ?? 0;

      const seenLeadIds = new Set<string>();
      const computedUnits = wonThisMonth
        .map((c) => c.lead)
        .filter((lead) => {
          if (seenLeadIds.has(lead.id)) return false;
          seenLeadIds.add(lead.id);
          return true;
        })
        .reduce((sum, lead) => sum + lead.products.reduce((s, p) => s + p.units, 0), 0);
      const units = unitsOverride ? Number(unitsOverride.value) : computedUnits;

      return {
        month,
        unitsAchieved: unitsTarget > 0 ? units >= unitsTarget : null,
        conversationsAchieved:
          conversationsTarget > 0 ? conversations >= conversationsTarget : null,
      };
    })
  );
}

// ---------------------------------------------------------------------------
// Beheer: de 12 productiemaanden (begin/einddatum) instellen (enkel Beheerder/Admin)
// ---------------------------------------------------------------------------

export type ProductionMonthConfig = {
  month: number;
  startDate: string;
  endDate: string;
};

/** De 12 productiemaanden van `year`, met ingestelde datums of anders de kalendermaand als voorstel. */
export async function getProductionMonthsForYear(
  year: number
): Promise<ProductionMonthConfig[]> {
  await requireGoalManager();
  const configured = await prisma.productionMonth.findMany({ where: { year } });
  const byMonth = new Map(configured.map((c) => [c.month, c]));

  return Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
    const existing = byMonth.get(month);
    if (existing) {
      return {
        month,
        startDate: toDateInputValue(existing.startDate),
        endDate: toDateInputValue(existing.endDate),
      };
    }
    const { start, end } = monthRange(year, month);
    return {
      month,
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(new Date(end.getTime() - 1)),
    };
  });
}

/** Slaat de begin/einddatum van alle 12 productiemaanden van `year` in één keer op. */
export async function saveProductionMonthDatesAction(
  year: number,
  formData: FormData
) {
  await requireGoalManager();

  const upserts = Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
    const startRaw = String(formData.get(`start_${month}`) ?? "");
    const endRaw = String(formData.get(`end_${month}`) ?? "");
    const startDate = new Date(`${startRaw}T00:00:00`);
    const endDate = new Date(`${endRaw}T23:59:59.999`);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      throw new Error(`Ongeldige datum voor productiemaand ${month}`);
    }
    return prisma.productionMonth.upsert({
      where: { year_month: { year, month } },
      create: { year, month, startDate, endDate },
      update: { startDate, endDate },
    });
  });

  await prisma.$transaction(upserts);

  revalidatePath("/beheer/doelen/productie");
  revalidatePath("/beheer/doelen");
  revalidatePath("/productie");
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Beheer: maandelijkse Klanten/Eenheden-doelen instellen (enkel Beheerder/Admin)
// ---------------------------------------------------------------------------

export async function getAllUserMonthlyGoalsForTable(year: number, month: number) {
  const actor = await requireGoalManager();
  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      role: true,
      monthlyGoals: { where: { year, month } },
    },
    orderBy: { name: "asc" },
  });
  const visible =
    actor.role === Role.BEHEERDER
      ? users
      : users.filter((u) => u.role !== Role.BEHEERDER);

  return visible.map((u) => ({
    id: u.id,
    name: u.name,
    role: u.role,
    targetByMetric: new Map(u.monthlyGoals.map((g) => [g.metric, Number(g.target)])),
  }));
}

export async function setUserMonthlyGoalAction(
  userId: string,
  metric: (typeof MONTHLY_GOAL_METRICS)[number],
  year: number,
  month: number,
  formData: FormData
) {
  await requireGoalManager();

  const raw = String(formData.get("target") ?? "").trim();
  const target = raw ? Number(raw) : 0;

  await prisma.userMonthlyGoal.upsert({
    where: { userId_metric_year_month: { userId, metric, year, month } },
    create: { userId, metric, year, month, target },
    update: { target },
  });

  revalidatePath("/productie");
  revalidatePath("/beheer/doelen/productie");
  revalidatePath("/beheer/doelen");
}

/**
 * Handmatige correctie op "Behaald" (Klanten/Eenheden) voor een gebruiker in
 * een productiemaand — overschrijft het automatisch berekende cijfer.
 * Vooral bedoeld om historische data (van vóór dit CRM) alsnog in te voeren.
 * Leeg maken verwijdert de correctie, zodat het weer het automatisch
 * berekende cijfer toont.
 */
export async function setUserMonthlyActualAction(
  userId: string,
  metric: (typeof MONTHLY_ACTUAL_METRICS)[number],
  year: number,
  month: number,
  formData: FormData
) {
  await requireGoalManager();

  const raw = String(formData.get("actual") ?? "").trim();

  if (!raw) {
    await prisma.userMonthlyActual.deleteMany({
      where: { userId, metric, year, month },
    });
  } else {
    const value = Number(raw);
    await prisma.userMonthlyActual.upsert({
      where: { userId_metric_year_month: { userId, metric, year, month } },
      create: { userId, metric, year, month, value },
      update: { value },
    });
  }

  revalidatePath("/productie");
  revalidatePath("/beheer/doelen/productie");
  revalidatePath("/dashboard");
}

export async function saveAllUserMonthlyGoalsAction(
  userIds: string[],
  year: number,
  month: number,
  formData: FormData
) {
  await requireGoalManager();

  const upserts = userIds.flatMap((userId) =>
    MONTHLY_GOAL_METRICS.map((metric) => {
      const raw = String(
        formData.get(`monthlyGoal_${userId}_${metric}`) ?? ""
      ).trim();
      const target = raw ? Number(raw) : 0;
      return prisma.userMonthlyGoal.upsert({
        where: { userId_metric_year_month: { userId, metric, year, month } },
        create: { userId, metric, year, month, target },
        update: { target },
      });
    })
  );

  await prisma.$transaction(upserts);

  revalidatePath("/beheer/doelen/productie");
  revalidatePath("/beheer/doelen");
  revalidatePath("/productie");
}
