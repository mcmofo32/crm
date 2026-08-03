"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageUsers } from "@/lib/permissions";
import { GoalMetric, JobFunction, Role } from "@/generated/prisma/client";

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

export async function getCurrentProductionMonth() {
  const now = new Date();
  return { year: now.getFullYear(), month: now.getMonth() + 1 };
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
  const { start, end } = monthRange(year, month);
  const weeksInMonth = (end.getTime() - start.getTime()) / (7 * 24 * 3600 * 1000);

  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      jobFunction: true,
      team: { select: { coach: { select: { name: true } } } },
      monthlyGoals: { where: { year, month } },
    },
    orderBy: { name: "asc" },
  });
  const userIds = users.map((u) => u.id);

  const [wonThisMonth, conversations] = await Promise.all([
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
        scheduledAt: { gte: start, lt: end },
        lead: { leadType: "FA" },
      },
      _count: { _all: true },
    }),
  ]);

  const conversationsByUser = new Map(
    conversations.map((c) => [c.assigneeId, c._count._all])
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
    const won = wonByUser.get(u.id);
    const actualCustomers = won?.customers.size ?? 0;
    const actualUnits = won?.units ?? 0;
    const targetCustomers = goalByMetric.get(GoalMetric.CUSTOMERS) ?? 0;
    const targetUnits = goalByMetric.get(GoalMetric.UNITS) ?? 0;
    const conversationsTotal = conversationsByUser.get(u.id) ?? 0;

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
      conversationsPerWeek:
        weeksInMonth > 0 ? Math.round((conversationsTotal / weeksInMonth) * 10) / 10 : 0,
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

export async function getConversationsLeaderboard(period?: {
  startDate: Date;
  endDate: Date;
}): Promise<ConversationsRow[]> {
  await requireViewer();
  const start = period?.startDate ?? currentWeekRange().start;
  const end = period
    ? new Date(period.endDate.getTime() + 1)
    : currentWeekRange().end;

  const users = await prisma.user.findMany({
    where: { active: true },
    select: {
      id: true,
      name: true,
      jobFunction: true,
      goals: { where: { metric: GoalMetric.CONVERSATIONS } },
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
      scheduledAt: { gte: start, lt: end },
      lead: { leadType: "FA" },
    },
    _count: { _all: true },
  });
  const actualByUser = new Map(
    conversations.map((c) => [c.assigneeId, c._count._all])
  );

  const rows = users.map((u) => {
    const target = Number(u.goals[0]?.target ?? 0);
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
// Beheer: maandelijkse Klanten/Eenheden-doelen instellen (enkel Beheerder/Admin)
// ---------------------------------------------------------------------------

const MONTHLY_GOAL_METRICS = [GoalMetric.CUSTOMERS, GoalMetric.UNITS] as const;

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
  revalidatePath("/productie");
}
