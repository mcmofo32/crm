"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getEffectiveViewer } from "@/lib/impersonation";
import { canManageUsers } from "@/lib/permissions";
import { KpiMetric } from "@/generated/prisma/client";
import { KPI_METRIC_ORDER, MANUAL_KPI_METRIC_ORDER } from "@/lib/goalLabels";
import { getEventAttendancePercent } from "@/lib/actions/events";
import { getMonthlyGoalAchievements } from "@/lib/actions/production";

async function requireGoalManager() {
  const viewer = await getEffectiveViewer();
  if (!viewer) throw new Error("Niet ingelogd");
  if (!canManageUsers(viewer)) {
    throw new Error("Je hebt geen rechten om doelen te beheren");
  }
  return viewer;
}

// ---------------------------------------------------------------------------
// Beheer: doelen per gebruiker instellen
// ---------------------------------------------------------------------------

export async function getGoalManagementUsers() {
  await requireGoalManager();
  return prisma.user.findMany({
    where: { active: true },
    select: { id: true, name: true, role: true },
    orderBy: { name: "asc" },
  });
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
 *   t.o.v. "aantal afgelopen productiemaanden met een ingesteld doel".
 * - KPI Seminarie/Belsessie: automatisch berekend als het percentage
 *   bevestigde Seminarie- resp. Belsessie-evenementen dit jaar waarop de
 *   gebruiker effectief aanwezig was (zie Evenementen) — geen van de 4
 *   jaarlijkse KPI's is nog manueel in te vullen.
 */
export async function getYearlyKpiProgress(
  userId: string,
  year: number
): Promise<KpiProgress[]> {
  const [seminarAttendance, callingSessionAttendance, monthlyAchievements] =
    await Promise.all([
      getEventAttendancePercent(userId, year, "SEMINAR"),
      getEventAttendancePercent(userId, year, "BELSESSIE"),
      getMonthlyGoalAchievements(userId, year),
    ]);

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
    if (metric === "CALLING_SESSION") {
      return {
        metric,
        actual: callingSessionAttendance.actual,
        target: callingSessionAttendance.total,
        percent: callingSessionAttendance.percent,
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
    const target = evaluatedConversationsMonths.length;
    return {
      metric,
      actual: achievedConversationsMonths,
      target,
      percent:
        target > 0 ? Math.round((achievedConversationsMonths / target) * 100) : null,
    };
  });
}
