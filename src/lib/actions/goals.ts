"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageUsers } from "@/lib/permissions";
import { KpiMetric, Role } from "@/generated/prisma/client";
import { KPI_METRIC_ORDER, MANUAL_KPI_METRIC_ORDER } from "@/lib/goalLabels";
import { getSeminarAttendancePercent } from "@/lib/actions/events";
import { getMonthlyGoalAchievements } from "@/lib/actions/production";

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

function toDateInputValue(date: Date) {
  return date.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Actieve periode: geldt voor alle gebruikers tegelijk
// ---------------------------------------------------------------------------

/** De actieve doelperiode, of de huidige kalenderweek als er nog niets is ingesteld. */
export async function getCurrentGoalPeriod() {
  const period = await prisma.goalPeriod.findFirst({
    orderBy: { updatedAt: "desc" },
  });
  if (period) {
    return { startDate: period.startDate, endDate: period.endDate };
  }
  const { start, end } = currentWeekRange();
  return { startDate: start, endDate: new Date(end.getTime() - 1) };
}

/** Voor het formulier bovenaan de doelentabel: begin/einddatum als input-strings. */
export async function getCurrentGoalPeriodForInput() {
  const { startDate, endDate } = await getCurrentGoalPeriod();
  return {
    startDate: toDateInputValue(startDate),
    endDate: toDateInputValue(endDate),
  };
}

export async function setGoalPeriodAction(formData: FormData) {
  await requireGoalManager();

  const startRaw = String(formData.get("periodStart") ?? "");
  const endRaw = String(formData.get("periodEnd") ?? "");
  const startDate = new Date(`${startRaw}T00:00:00`);
  const endDate = new Date(`${endRaw}T23:59:59.999`);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    throw new Error("Ongeldige begin- of einddatum");
  }

  const existing = await prisma.goalPeriod.findFirst();
  if (existing) {
    await prisma.goalPeriod.update({
      where: { id: existing.id },
      data: { startDate, endDate },
    });
  } else {
    await prisma.goalPeriod.create({ data: { startDate, endDate } });
  }

  revalidatePath("/beheer/doelen");
  revalidatePath("/dashboard");
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

export async function getUserKpiGoals(userId: string) {
  await requireGoalManager();
  const kpiGoals = await prisma.userKpiGoal.findMany({ where: { userId } });
  return new Map(kpiGoals.map((g) => [`${g.metric}:${g.year}`, Number(g.target)]));
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

/** Slaat de 3 manueel ingestelde jaarlijkse KPI-doelen (voor `year`) van deze gebruiker op. */
export async function saveUserKpiGoalsAction(
  userId: string,
  year: number,
  formData: FormData
) {
  await requireGoalManager();

  const kpiGoalUpserts = MANUAL_KPI_METRIC_ORDER.map((metric) => {
    const raw = String(formData.get(`kpiGoal_${metric}`) ?? "").trim();
    const target = raw ? Number(raw) : 0;
    return prisma.userKpiGoal.upsert({
      where: { userId_metric_year: { userId, metric, year } },
      create: { userId, metric, year, target },
      update: { target },
    });
  });

  await prisma.$transaction(kpiGoalUpserts);

  revalidatePath(`/beheer/doelen/${userId}`);
  revalidatePath("/dashboard");
}

/** Slaat de 12 maandwaarden van de 3 manuele jaarlijkse KPI's voor `year` op. */
export async function saveUserKpiMonthlyEntriesAction(
  userId: string,
  year: number,
  formData: FormData
) {
  await requireGoalManager();

  const upserts = MANUAL_KPI_METRIC_ORDER.flatMap((metric) =>
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

export type KpiProgress = {
  metric: KpiMetric;
  actual: number;
  target: number;
  percent: number | null;
};

/**
 * Jaarlijkse KPI-voortgang voor `year`.
 *
 * - KPI Productie/Gesprekken: automatisch berekend als "aantal afgelopen
 *   productiemaanden waarin het Eenheden- resp. Gesprekken-doel gehaald is"
 *   t.o.v. "aantal afgelopen productiemaanden met een ingesteld doel" — net
 *   als KPI Seminarie is dit geen manueel doel meer.
 * - KPI Belsessie: som van de manueel ingevoerde maandwaarden t.o.v. het
 *   manueel ingestelde jaardoel.
 */
export async function getYearlyKpiProgress(
  userId: string,
  year: number
): Promise<KpiProgress[]> {
  const [targets, callingSessionEntries, seminarAttendance, monthlyAchievements] =
    await Promise.all([
      prisma.userKpiGoal.findMany({ where: { userId, year } }),
      prisma.userKpiMonthlyEntry.findMany({
        where: { userId, year, metric: KpiMetric.CALLING_SESSION },
      }),
      getSeminarAttendancePercent(userId, year),
      getMonthlyGoalAchievements(userId, year),
    ]);

  const targetByMetric = new Map(
    targets.map((t) => [t.metric, Number(t.target)])
  );
  const callingSessionActual = callingSessionEntries.reduce(
    (sum, entry) => sum + Number(entry.value),
    0
  );

  const evaluatedProductionMonths = monthlyAchievements.filter(
    (m) => m.unitsAchieved !== null
  );
  const achievedProductionMonths = evaluatedProductionMonths.filter(
    (m) => m.unitsAchieved
  ).length;
  const evaluatedConversationsMonths = monthlyAchievements.filter(
    (m) => m.conversationsAchieved !== null
  );
  const achievedConversationsMonths = evaluatedConversationsMonths.filter(
    (m) => m.conversationsAchieved
  ).length;

  return KPI_METRIC_ORDER.map((metric) => {
    if (metric === "SEMINAR") {
      return {
        metric,
        actual: seminarAttendance.actual,
        target: seminarAttendance.total,
        percent: seminarAttendance.percent,
      };
    }
    if (metric === "PRODUCTION") {
      const target = evaluatedProductionMonths.length;
      return {
        metric,
        actual: achievedProductionMonths,
        target,
        percent: target > 0 ? Math.round((achievedProductionMonths / target) * 100) : null,
      };
    }
    if (metric === "CONVERSATIONS") {
      const target = evaluatedConversationsMonths.length;
      return {
        metric,
        actual: achievedConversationsMonths,
        target,
        percent:
          target > 0 ? Math.round((achievedConversationsMonths / target) * 100) : null,
      };
    }
    const target = targetByMetric.get(metric) ?? 0;
    const actual = callingSessionActual;
    return {
      metric,
      actual,
      target,
      percent: target > 0 ? Math.round((actual / target) * 100) : null,
    };
  });
}
