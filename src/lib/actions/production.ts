"use server";

import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { GoalMetric, JobFunction } from "@/generated/prisma/client";

async function requireViewer() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
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
      goals: {
        where: { metric: { in: [GoalMetric.CUSTOMERS, GoalMetric.UNITS] } },
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
      u.goals.map((g) => [g.metric, Number(g.target)])
    );
    const won = wonByUser.get(u.id);
    const actualCustomers = won?.customers.size ?? 0;
    const actualUnits = won?.units ?? 0;
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
