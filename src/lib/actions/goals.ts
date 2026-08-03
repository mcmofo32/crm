"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageUsers } from "@/lib/permissions";
import {
  GoalMetric,
  KpiMetric,
  LeadType,
  Role,
} from "@/generated/prisma/client";
import { GOAL_METRIC_ORDER, KPI_METRIC_ORDER } from "@/lib/goalLabels";

async function requireGoalManager() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canManageUsers(viewer)) {
    throw new Error("Je hebt geen rechten om doelen te beheren");
  }
  return viewer;
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

// ---------------------------------------------------------------------------
// Beheer: doelen per gebruiker instellen
// ---------------------------------------------------------------------------

export async function getGoalManagementUsers() {
  const actor = await requireGoalManager();
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
  return actor.role === Role.BEHEERDER
    ? users
    : users.filter((u) => u.role !== Role.BEHEERDER);
}

export async function getUserForGoals(userId: string) {
  await requireGoalManager();
  return prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, role: true },
  });
}

export async function getUserGoals(userId: string) {
  await requireGoalManager();
  const [goals, kpiGoals] = await Promise.all([
    prisma.userGoal.findMany({ where: { userId } }),
    prisma.userKpiGoal.findMany({ where: { userId } }),
  ]);

  const goalByMetric = new Map(goals.map((g) => [g.metric, Number(g.target)]));
  const kpiGoalByMetricYear = new Map(
    kpiGoals.map((g) => [`${g.metric}:${g.year}`, Number(g.target)])
  );

  return { goalByMetric, kpiGoalByMetricYear };
}

export async function getUserKpiMonthlyEntries(userId: string, year: number) {
  await requireGoalManager();
  const entries = await prisma.userKpiMonthlyEntry.findMany({
    where: { userId, year },
  });
  const byMetricMonth = new Map(
    entries.map((e) => [`${e.metric}:${e.month}`, Number(e.value)])
  );
  return byMetricMonth;
}

/** Slaat de 5 wekelijkse doelen + 4 jaarlijkse KPI-doelen (voor `year`) in één keer op. */
export async function saveUserGoalsAction(
  userId: string,
  year: number,
  formData: FormData
) {
  await requireGoalManager();

  const goalUpserts = GOAL_METRIC_ORDER.map((metric) => {
    const raw = String(formData.get(`goal_${metric}`) ?? "").trim();
    const target = raw ? Number(raw) : 0;
    return prisma.userGoal.upsert({
      where: { userId_metric: { userId, metric } },
      create: { userId, metric, target },
      update: { target },
    });
  });

  const kpiGoalUpserts = KPI_METRIC_ORDER.map((metric) => {
    const raw = String(formData.get(`kpiGoal_${metric}`) ?? "").trim();
    const target = raw ? Number(raw) : 0;
    return prisma.userKpiGoal.upsert({
      where: { userId_metric_year: { userId, metric, year } },
      create: { userId, metric, year, target },
      update: { target },
    });
  });

  await prisma.$transaction([...goalUpserts, ...kpiGoalUpserts]);

  revalidatePath(`/beheer/doelen/${userId}`);
  revalidatePath("/dashboard");
}

/** Slaat de 12 maandwaarden van de 4 jaarlijkse KPI's voor `year` op. */
export async function saveUserKpiMonthlyEntriesAction(
  userId: string,
  year: number,
  formData: FormData
) {
  await requireGoalManager();

  const upserts = KPI_METRIC_ORDER.flatMap((metric) =>
    Array.from({ length: 12 }, (_, i) => i + 1).map((month) => {
      const raw = String(
        formData.get(`monthly_${metric}_${month}`) ?? ""
      ).trim();
      const value = raw ? Number(raw) : 0;
      return prisma.userKpiMonthlyEntry.upsert({
        where: {
          userId_metric_year_month: { userId, metric, year, month },
        },
        create: { userId, metric, year, month, value },
        update: { value },
      });
    })
  );

  await prisma.$transaction(upserts);

  revalidatePath(`/beheer/doelen/${userId}`);
  revalidatePath("/dashboard");
}

// ---------------------------------------------------------------------------
// Dashboard: doel vs. stand van zaken voor de ingelogde gebruiker
// ---------------------------------------------------------------------------

export type GoalProgress = {
  metric: GoalMetric;
  actual: number;
  target: number;
  percent: number | null;
};

/**
 * Wekelijkse "stand van zaken" per doel, voor de ingelogde gebruiker.
 *
 * Aannames (nog te bevestigen): Eenheden/Klanten/ABV worden geteld op het
 * moment dat een lead deze week klant wordt (stage-overgang naar een
 * "gewonnen"-fase); Gesprekken = deze week afgeronde activiteiten (CALL/MEETING).
 */
export async function getWeeklyGoalProgress(
  userId: string
): Promise<GoalProgress[]> {
  const { start, end } = currentWeekRange();

  const [targets, wonThisWeek, conversations] = await Promise.all([
    prisma.userGoal.findMany({ where: { userId } }),
    prisma.leadStageChange.findMany({
      where: {
        changedById: userId,
        toStage: { isWon: true },
        changedAt: { gte: start, lt: end },
      },
      select: {
        lead: {
          select: {
            id: true,
            leadType: true,
            products: { select: { amount: true, units: true } },
          },
        },
      },
    }),
    prisma.activity.count({
      where: {
        assigneeId: userId,
        status: "COMPLETED",
        type: { in: ["CALL", "MEETING"] },
        completedAt: { gte: start, lt: end },
      },
    }),
  ]);

  const targetByMetric = new Map(
    targets.map((t) => [t.metric, Number(t.target)])
  );

  const seenLeadIds = new Set<string>();
  const wonLeads = wonThisWeek
    .map((c) => c.lead)
    .filter((lead) => {
      if (seenLeadIds.has(lead.id)) return false;
      seenLeadIds.add(lead.id);
      return true;
    });

  const units = wonLeads.reduce(
    (sum, lead) => sum + lead.products.reduce((s, p) => s + p.units, 0),
    0
  );
  const customers = wonLeads.length;

  const dealValue = (leadType: LeadType) => {
    const leads = wonLeads.filter((l) => l.leadType === leadType);
    if (leads.length === 0) return 0;
    const total = leads.reduce(
      (sum, lead) =>
        sum + lead.products.reduce((s, p) => s + Number(p.amount), 0),
      0
    );
    return total / leads.length;
  };

  const actualByMetric: Record<GoalMetric, number> = {
    UNITS: units,
    CUSTOMERS: customers,
    CONVERSATIONS: conversations,
    ABV_SALES: dealValue("FA"),
    ABV_RG: dealValue("RG"),
  };

  return GOAL_METRIC_ORDER.map((metric) => {
    const target = targetByMetric.get(metric) ?? 0;
    const actual = actualByMetric[metric];
    return {
      metric,
      actual,
      target,
      percent: target > 0 ? Math.round((actual / target) * 100) : null,
    };
  });
}

export type KpiProgress = {
  metric: KpiMetric;
  actual: number;
  target: number;
  percent: number | null;
};

/** Jaarlijkse KPI-voortgang (som van de manueel ingevoerde maandwaarden) voor `year`. */
export async function getYearlyKpiProgress(
  userId: string,
  year: number
): Promise<KpiProgress[]> {
  const [targets, entries] = await Promise.all([
    prisma.userKpiGoal.findMany({ where: { userId, year } }),
    prisma.userKpiMonthlyEntry.findMany({ where: { userId, year } }),
  ]);

  const targetByMetric = new Map(
    targets.map((t) => [t.metric, Number(t.target)])
  );
  const actualByMetric = new Map<KpiMetric, number>();
  for (const entry of entries) {
    actualByMetric.set(
      entry.metric,
      (actualByMetric.get(entry.metric) ?? 0) + Number(entry.value)
    );
  }

  return KPI_METRIC_ORDER.map((metric) => {
    const target = targetByMetric.get(metric) ?? 0;
    const actual = actualByMetric.get(metric) ?? 0;
    return {
      metric,
      actual,
      target,
      percent: target > 0 ? Math.round((actual / target) * 100) : null,
    };
  });
}
